package utils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.testng.ITestResult;
import org.testng.Reporter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * The logins saved in FIA (Test Data → Credentials), by the name the tester gave them - "Admin", "Supervisor",
 * "Member" … - with their fields in order (Account, Username, Password, OTP …):
 * <pre>
 *   String user = Credentials.get("Supervisor", "Username");
 *   String password = Credentials.get("Supervisor", "Password");
 * </pre>
 * Or the login the test runs as - set on its suite or on the test in FIA (Tests page → "Runs as"), or for the
 * whole run in the Run dialog; {@code -Dlogin=<name>} does the same for a local run:
 * <pre>
 *   String user = Credentials.current("Username");
 * </pre>
 * A test with more than one actor - an admin approves what a user sent - names a login per role in FIA (Tests page →
 * "+ Login for a role"); the test asks by role, never by name:
 * <pre>
 *   String approver = Credentials.as("approves");             // "Admin"
 *   String password = Credentials.as("approves", "Password");
 * </pre>
 * The FIA runner writes them for the run's environment to {@code data/credentials.json} just before the run and
 * deletes the file after it (it is git-ignored); {@code -DcredentialsFile=<path>} or the environment variable
 * {@code FIA_CREDENTIALS_FILE} point elsewhere (AI sessions keep it outside the agent's folder). Never log or report a
 * value read here.
 */
public final class Credentials {

    private static Map<String, Map<String, String>> logins;
    private static String environment = "";
    /** the run's login (the suite's, or the Run dialog's for every test) and the tests' own: class#method#block → login */
    private static String runLogin;
    private static Map<String, String> testLogins = Map.of();
    /** a test's roles: class#method#block → role → login */
    private static Map<String, Map<String, String>> testRoles = Map.of();

    private Credentials() {
    }

    /** One field of a login, e.g. {@code get("Supervisor", "Password")}. Login and field names ignore case. */
    public static String get(String login, String field) {
        Map<String, String> fields = of(login);
        for (Map.Entry<String, String> f : fields.entrySet()) {
            if (f.getKey().equalsIgnoreCase(field)) {
                return f.getValue();
            }
        }
        throw new IllegalStateException("The login \"" + login + "\" on " + environment + " has no field \"" + field
                + "\" (it has " + fields.keySet() + ") - add it in FIA > Test Data > Credentials");
    }

    /**
     * One field of the login this test runs as: {@code current("Password")}. Inside a test (and what it calls) that is
     * the test's own login, else its suite's; in a @Before… method the suite's. -Dlogin=&lt;name&gt; wins over both.
     */
    public static String current(String field) {
        return get(currentLogin(), field);
    }

    /** The name of the login this test runs as (see {@link #current}). */
    public static String currentLogin() {
        load();
        String forced = System.getProperty("login");
        if (forced != null && !forced.isBlank()) {
            return forced.trim();
        }
        ITestResult test = Reporter.getCurrentTestResult();
        if (test != null && test.getMethod() != null && test.getMethod().isTest()) {
            String method = test.getMethod().getRealClass().getName() + "#" + test.getMethod().getMethodName() + "#";
            String block = test.getTestContext() == null ? "" : test.getTestContext().getName();
            String own = testLogins.get(method + block);
            if (own == null) { // the same method in another <test> block: only when they all agree
                Set<String> found = new HashSet<>();
                testLogins.forEach((key, login) -> {
                    if (key.startsWith(method)) {
                        found.add(login);
                    }
                });
                own = found.size() == 1 ? found.iterator().next() : null;
            }
            if (own != null) {
                return own;
            }
        }
        if (runLogin != null && !runLogin.isBlank()) {
            return runLogin;
        }
        throw new IllegalStateException("No login is set for this test on " + environment + " - choose one in FIA > Tests "
                + "(\"Runs as\" on the suite or the test) or in the Run dialog, or run with -Dlogin=<name>");
    }

    /**
     * The login of a role of this test (Tests page → "+ Login for a role"), e.g. {@code as("approves")} → "Admin". A role
     * set on no test of the run is taken as a login name itself, so {@code as("Admin")} works too. -Drole.&lt;role&gt;=&lt;login&gt;
     * sets one for a local run.
     */
    public static String as(String role) {
        load();
        String forced = System.getProperty("role." + role);
        if (forced != null && !forced.isBlank()) return forced.trim();
        ITestResult test = Reporter.getCurrentTestResult();
        if (test != null && test.getMethod() != null) {
            String method = test.getMethod().getRealClass().getName() + "#" + test.getMethod().getMethodName() + "#";
            String block = test.getTestContext() == null ? "" : test.getTestContext().getName();
            String own = roleOf(testRoles.get(method + block), role);
            if (own == null) { // the same method in another block: only when they all agree
                Set<String> found = new HashSet<>();
                testRoles.forEach((key, roles) -> { if (key.startsWith(method)) { String l = roleOf(roles, role); if (l != null) found.add(l); } });
                own = found.size() == 1 ? found.iterator().next() : null;
            }
            if (own != null) return own;
        }
        for (String name : load().keySet()) {
            if (name.equalsIgnoreCase(role)) return name; // a login's own name
        }
        throw new IllegalStateException("No login is set for the role \"" + role + "\" of this test on " + environment
                + " - add it in FIA > Tests (\"+ Login for a role\" on the test), or run with -Drole." + role + "=<login>");
    }

    /** One field of a role's login: {@code as("approves", "Password")}. */
    public static String as(String role, String field) {
        return get(as(role), field);
    }

    private static String roleOf(Map<String, String> roles, String role) {
        if (roles == null) return null;
        for (Map.Entry<String, String> r : roles.entrySet()) if (r.getKey().equalsIgnoreCase(role)) return r.getValue();
        return null;
    }

    /** All fields of a login, in their order. */
    public static Map<String, String> of(String login) {
        for (Map.Entry<String, Map<String, String>> l : load().entrySet()) {
            if (l.getKey().equalsIgnoreCase(login)) {
                return Collections.unmodifiableMap(l.getValue());
            }
        }
        throw new IllegalStateException("No login \"" + login + "\" on " + environment + " (there are " + load().keySet()
                + ") - add it in FIA > Test Data > Credentials");
    }

    /** The names of the logins of this run's environment. */
    public static Set<String> logins() {
        return Collections.unmodifiableSet(load().keySet());
    }

    private static synchronized Map<String, Map<String, String>> load() {
        if (logins != null) {
            return logins;
        }
        String fromEnv = System.getenv("FIA_CREDENTIALS_FILE"); TrovaRun.require(); // TICKET-1021: only a run Trova started
        Path file = Path.of(System.getProperty("credentialsFile",
                fromEnv != null && !fromEnv.isBlank() ? fromEnv : "data/credentials.json"));
        if (!Files.isRegularFile(file)) {
            throw new IllegalStateException(TrovaRun.REFUSAL + " - it gives each run the logins saved in Test Data > Credentials");
        }
        try {
            JsonObject root = JsonParser.parseString(Files.readString(file, StandardCharsets.UTF_8)).getAsJsonObject();
            environment = root.has("environment") ? root.get("environment").getAsString() : "";
            Map<String, Map<String, String>> all = new LinkedHashMap<>();
            for (Map.Entry<String, JsonElement> login : root.getAsJsonObject("logins").entrySet()) {
                Map<String, String> fields = new LinkedHashMap<>();
                for (Map.Entry<String, JsonElement> f : login.getValue().getAsJsonObject().entrySet()) {
                    fields.put(f.getKey(), f.getValue().isJsonNull() ? "" : f.getValue().getAsString());
                }
                all.put(login.getKey(), fields);
            }
            JsonObject run = root.has("run") && root.get("run").isJsonObject() ? root.getAsJsonObject("run") : new JsonObject();
            runLogin = run.has("login") && !run.get("login").isJsonNull() ? run.get("login").getAsString() : null;
            Map<String, String> perTest = new HashMap<>();
            if (run.has("tests") && run.get("tests").isJsonObject()) {
                run.getAsJsonObject("tests").entrySet().forEach(t -> perTest.put(t.getKey(), t.getValue().getAsString()));
            }
            testLogins = perTest;
            Map<String, Map<String, String>> roles = new HashMap<>();
            if (run.has("roles") && run.get("roles").isJsonObject()) {
                run.getAsJsonObject("roles").entrySet().forEach(t -> {
                    Map<String, String> r = new LinkedHashMap<>();
                    t.getValue().getAsJsonObject().entrySet().forEach(x -> r.put(x.getKey(), x.getValue().getAsString()));
                    roles.put(t.getKey(), r);
                });
            }
            testRoles = roles;
            logins = all;
            return logins;
        } catch (IOException | RuntimeException e) {
            throw new IllegalStateException("Could not read " + file + ": " + e.getMessage(), e);
        }
    }
}
