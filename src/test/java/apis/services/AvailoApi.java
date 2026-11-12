package apis.services;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import io.restassured.response.Response;
import utils.Credentials;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import static io.restassured.RestAssured.given;

/**
 * The admin API of the web portal: the sign-in (account code, user name + password, then the one-time code) and the
 * calls the portal itself makes. Every body is wrapped as {"Data": ..., "TimeZoneOffset": -180, "Language": 0} and every
 * answer as {Data, Status, Message}. The fixed headers (ServiceKey, ClientKey) come from Trova's Test Data → Environments.
 */
public final class AvailoApi {

    private static final Gson GSON = new Gson();

    /** What the portal keeps after a sign-in; {@code user} and {@code account} are the answers' Data as the app stores them. */
    public record Login(String token, String accountId, String code, JsonObject user, JsonObject account) {
    }

    private AvailoApi() {
    }

    /** the plain words a refused sign-in leaves for every later test */
    public static final String REFUSED = "sign-in refused - fix the login in Test Data → Credentials";
    private static final Map<String, Login> SIGNED_IN = new java.util.concurrent.ConcurrentHashMap<>();
    private static final Set<String> REFUSED_LOGINS = java.util.concurrent.ConcurrentHashMap.newKeySet();

    /**
     * Signs in as a Trova login (account code, user name, password, OTP) once per run and reuses it; a refusal fails
     * once and every later call skips with {@link #REFUSED} - never a retry (repeated refusals lock the account).
     */
    public static synchronized Login login(String login) {
        if (REFUSED_LOGINS.contains(login)) throw new org.testng.SkipException(REFUSED);
        Login kept = SIGNED_IN.get(login);
        if (kept != null) return kept;
        try {
            Login fresh = signIn(login);
            SIGNED_IN.put(login, fresh);
            return fresh;
        } catch (IllegalStateException e) {
            REFUSED_LOGINS.add(login);
            // the app's own reason in plain words (wrong password → Credentials; missing headers → Environments)
            throw new IllegalStateException(utils.SignInRefusal.words("Availo", e.getMessage(), true) + " (" + login + ")");
        }
    }

    private static Login signIn(String login) {
        String code = field(login, "account code", "Account", "Account code", "code");
        JsonObject account = data(post(null, "Account/GetAccountIdByCode", wrapped(Map.of("code", code))));
        String accountId = account.get("ID").getAsString();
        String user = field(login, "Username", "User name", "User", "Email");
        String password = encodePassword(field(login, "Password"));

        JsonObject credentials = new JsonObject();
        credentials.addProperty("AccountID", accountId);
        credentials.addProperty("userName", user);
        credentials.addProperty("password", password);
        credentials.addProperty("ReCaptchaToken", "");
        JsonObject step1 = data(post(null, "User/Login", wrapped(credentials)));
        if (step1 != null && step1.has("AccessToken") && !step1.get("AccessToken").isJsonNull()
                && !step1.get("AccessToken").getAsString().isEmpty()) { // a trial account signs in without the code
            return new Login(step1.get("AccessToken").getAsString(), accountId, code, step1, account);
        }

        JsonObject verify = new JsonObject();
        verify.addProperty("UserName", user);
        verify.addProperty("Password", password);
        verify.addProperty("AccountID", accountId);
        verify.addProperty("PhoneNumber", step1 != null && step1.has("PhoneNumber") && !step1.get("PhoneNumber").isJsonNull()
                ? step1.get("PhoneNumber").getAsString() : "");
        verify.addProperty("VerificationCode", field(login, "OTP", "Verification code", "code otp"));
        JsonObject signedIn = data(post(null, "User/VerifyCode", wrapped(verify)));
        return new Login(signedIn.get("AccessToken").getAsString(), accountId, code, signedIn, account);
    }

    /**
     * The portal never sends the plain password: its login page shifts each character by the key "Av@il0" (padded
     * with 'A' to the password's length) plus 107 - the same function as the portal's own sign-in script.
     */
    static String encodePassword(String password) {
        StringBuilder key = new StringBuilder("Av@il0");
        while (key.length() < password.length()) key.append('A');
        StringBuilder encoded = new StringBuilder();
        for (int i = 0; i < password.length(); i++) {
            encoded.append((char) (password.charAt(i) - key.charAt(i) + 107));
        }
        return encoded.toString();
    }

    /** the login's field under any of its usual names ("account code" or "Account" …) */
    public static String field(String login, String... names) {
        Map<String, String> fields = Credentials.of(login);
        for (String n : names) {
            for (Map.Entry<String, String> f : fields.entrySet()) {
                if (f.getKey().trim().equalsIgnoreCase(n)) return f.getValue();
            }
        }
        throw new IllegalArgumentException("The login \"" + login + "\" has no " + names[0] + " - add it in Test Data → Credentials");
    }

    /** The id of the employee with this job number, found through the employees list. */
    public static String employeeId(Login login, String jobNumber) {
        JsonObject data = new JsonObject();
        data.addProperty("searchTerm", jobNumber);
        data.add("DepartementIds", new JsonArray());
        JsonObject body = new JsonObject();
        body.addProperty("pageNumber", 1);
        body.addProperty("pageSize", 20);
        body.add("data", data);
        JsonElement answer = JsonParser.parseString(post(login.token(), "User/GetAllUser", body).asString());
        String id = findId(answer, "JobNumber", jobNumber, "ID");
        if (id == null) {
            throw new IllegalStateException("No employee with job number " + jobNumber + " in this account");
        }
        return id;
    }

    /** The ids of the employee's leave requests that start or end between the two days (yyyy-MM-dd). */
    public static Set<String> leaveIds(Login login, String employeeId, String from, String to) {
        JsonObject filter = new JsonObject();
        filter.addProperty("AccountID", login.accountId());
        filter.addProperty("LeaveNumber", "");
        filter.add("DepartmentsIDs", new JsonArray());
        filter.add("employeeGroups", new JsonArray());
        JsonArray employees = new JsonArray();
        employees.add(employeeId);
        filter.add("EmployeesIDs", employees);
        filter.addProperty("FromDate", from);
        filter.addProperty("ToDate", to);
        filter.addProperty("StatusId", 0);
        filter.addProperty("TypeID", 0);
        filter.addProperty("AssignToMe", false);
        filter.addProperty("FromApproval", false);
        JsonObject body = new JsonObject();
        body.addProperty("pageNumber", 1);
        body.addProperty("pageSize", 100);
        body.add("data", filter);
        Set<String> ids = new LinkedHashSet<>();
        collectLeaveIds(JsonParser.parseString(post(login.token(), "Leaves/GetAllLeaves", body).asString()), ids);
        return ids;
    }

    /** Deletes one leave request (the list then shows it as deleted). */
    public static void deleteLeave(Login login, String leaveId) {
        post(login.token(), "Leaves/DeleteLeave", wrapped(leaveId));
    }

    /** The id of the registration request with this job number, or null when the list has none. */
    public static String pendingUserId(Login login, String jobNumber) {
        JsonObject data = new JsonObject();
        data.addProperty("SearchPattern", jobNumber);
        data.add("DepartmentsIDs", new JsonArray());
        data.addProperty("Type", 15);
        data.addProperty("Status", 3);
        JsonObject body = new JsonObject();
        body.addProperty("pageNumber", 1);
        body.addProperty("pageSize", 10);
        body.add("data", data);
        JsonElement answer = JsonParser.parseString(post(login.token(), "User/GetAllUserPending", body).asString());
        String id = findId(answer, "JobNumber", jobNumber, "ID");
        return id != null ? id : findId(answer, "JobNumber", jobNumber, "UserId");
    }

    /** Deletes one registration request. */
    public static void deletePendingUser(Login login, String userId) {
        JsonObject data = new JsonObject();
        data.addProperty("UserId", userId);
        data.addProperty("RejectionReason", "");
        JsonObject body = new JsonObject();
        body.add("data", data);
        post(login.token(), "User/DeleteRequest", body);
    }

    private static JsonObject wrapped(Object data) {
        JsonObject envelope = new JsonObject();
        envelope.add("Data", GSON.toJsonTree(data));
        return envelope;
    }

    private static Response post(String token, String path, JsonObject envelope) {
        envelope.addProperty("TimeZoneOffset", -180);
        envelope.addProperty("Language", 0);
        var request = given(SpecFactory.getSpec("")).body(GSON.toJson(envelope));
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        Response response = request.post(url(path));
        if (response.statusCode() >= 400) {
            throw new IllegalStateException(path + " answered HTTP " + response.statusCode());
        }
        return response;
    }

    /** The API address may already end with /api: add it only when it does not. */
    private static String url(String path) {
        String base = utils.TestData.apiUrl().replaceAll("/+$", "");
        return (base.endsWith("/api") ? "" : "api/") + path;
    }

    private static JsonObject data(Response response) {
        JsonObject answer = JsonParser.parseString(response.asString()).getAsJsonObject();
        if (answer.has("Status") && !answer.get("Status").getAsBoolean()) {
            throw new IllegalStateException("The portal refused the call: " + answer.get("Message"));
        }
        return answer.getAsJsonObject("Data");
    }

    /** First object anywhere in the answer whose {@code key} equals {@code value}; returns its {@code idKey}. */
    private static String findId(JsonElement node, String key, String value, String idKey) {
        if (node.isJsonObject()) {
            JsonObject object = node.getAsJsonObject();
            if (object.has(key) && !object.get(key).isJsonNull() && value.equals(object.get(key).getAsString())
                    && object.has(idKey)) {
                return object.get(idKey).getAsString();
            }
            for (var entry : object.entrySet()) {
                String found = findId(entry.getValue(), key, value, idKey);
                if (found != null) {
                    return found;
                }
            }
        } else if (node.isJsonArray()) {
            for (JsonElement item : node.getAsJsonArray()) {
                String found = findId(item, key, value, idKey);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    /** Every object of the answer that looks like a leave row (an ID with its dates). */
    private static void collectLeaveIds(JsonElement node, Set<String> ids) {
        if (node.isJsonObject()) {
            JsonObject object = node.getAsJsonObject();
            if (object.has("ID") && !object.get("ID").isJsonNull() && object.has("FromDate")) {
                ids.add(object.get("ID").getAsString());
            }
            object.entrySet().forEach(entry -> collectLeaveIds(entry.getValue(), ids));
        } else if (node.isJsonArray()) {
            node.getAsJsonArray().forEach(item -> collectLeaveIds(item, ids));
        }
    }
}
