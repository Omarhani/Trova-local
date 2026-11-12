package utils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Trova DEF-394 (story DEF-389) - everything a test needs about its environment, from Trova: Trova is the only source
 * of test data (Test Data → Environments). The runner hands each run its environment's data next to its logins (the
 * "testData" part of the run's credentials file - FIA_CREDENTIALS_FILE, or data/credentials.json); this class reads it
 * once and keeps it. No data file in the code.
 *
 * <pre>
 *   TestData.webUrl()            the web app of the run's environment
 *   TestData.apiUrl()            its API; TestData.mobileApiUrl() the API the mobile app calls (empty = the API)
 *   TestData.apiHeaders()        headers sent with every API call (ServiceKey, ClientKey …)
 *   TestData.mobile().appPackage() / appActivity() / appFile()
 *   TestData.email().server() / mailbox() / sender()
 *   TestData.env()               the environment the suite runs on (Test, Stage …) - set once per suite
 * </pre>
 */
public final class TestData {

    public static final String DEFAULT_ENV = "Test";

    public record Mobile(String appPackage, String appActivity, String appFile) {
        /** Where the app file is: as given when absolute, else Test Data → Attachments (data/attachments), else the home folder. */
        public String appFilePath() {
            if (appFile == null || appFile.isBlank()) return "";
            java.io.File f = new java.io.File(appFile);
            if (f.isAbsolute()) return f.getPath();
            java.io.File attached = new java.io.File("data/attachments", appFile);
            return attached.isFile() ? attached.getPath() : new java.io.File(System.getProperty("user.home"), appFile).getPath();
        }
    }

    public record Email(String server, String mailbox, String sender) {
    }

    private static volatile String env = DEFAULT_ENV;
    private static volatile JsonObject snapshot;

    private TestData() {
    }

    // ---- the environment of the suite ----

    public static String env() {
        return env;
    }

    /** Sets the environment from the suite's {@code server} parameter; empty or {@code ${...}} = {@link #DEFAULT_ENV}. */
    public static String setEnv(String server) {
        env = server == null || server.isBlank() || server.startsWith("${") ? DEFAULT_ENV : server.trim();
        return env;
    }

    public static boolean isEnv(String name) {
        return env.equalsIgnoreCase(name);
    }

    /** The report folder of the environment: Test → testEnv, Stage → stageEnv. */
    public static String reportFolder() {
        return Character.toLowerCase(env.charAt(0)) + env.substring(1) + "Env";
    }

    // ---- the environment's data ----

    public static String webUrl() {
        return address("WEB_URL");
    }

    public static String apiUrl() {
        return address("API_BASE_URI");
    }

    /** The API the mobile app calls; empty = the same as {@link #apiUrl()}. */
    public static String mobileApiUrl() {
        String mobile = address("MOBILE_API_BASE_URI");
        return mobile.isBlank() ? apiUrl() : mobile;
    }

    public static Map<String, String> apiHeaders() {
        Map<String, String> out = new LinkedHashMap<>();
        JsonObject headers = object(object(data(), "API"), "HEADERS");
        headers.entrySet().forEach(e -> out.put(e.getKey(), text(e.getValue())));
        return Collections.unmodifiableMap(out);
    }

    /**
     * Trova (Omar 2026-10-23): the environment's API headers that change on every call (a request id, a timestamp) -
     * names only; {@link #apiHeadersForOneCall()} gives each a fresh value.
     */
    public static java.util.List<String> perRequestHeaders() {
        JsonElement names = object(data(), "API").get("PER_REQUEST_HEADERS");
        java.util.List<String> out = new java.util.ArrayList<>();
        if (names != null && names.isJsonArray()) names.getAsJsonArray().forEach(n -> out.add(text(n)));
        return out;
    }

    /** The fixed API headers plus a fresh value for each per-call one (time-like names: the time in ms, else a new id). */
    public static Map<String, String> apiHeadersForOneCall() {
        Map<String, String> out = new LinkedHashMap<>(apiHeaders());
        for (String name : perRequestHeaders()) {
            out.put(name, name.toLowerCase().matches(".*(time|date).*") ? String.valueOf(System.currentTimeMillis())
                    : java.util.UUID.randomUUID().toString());
        }
        return out;
    }

    /** Omar 2026-10-25: the run's environment is marked Prod in Test Data → Environments (no test codes there) */
    public static boolean isProd() {
        JsonElement p = data().get("PROD");
        return p != null && p.isJsonPrimitive() && p.getAsBoolean();
    }

    public static Mobile mobile() {
        JsonObject m = object(data(), "MOBILE");
        return new Mobile(text(m.get("APP_PACKAGE")), text(m.get("APP_ACTIVITY")), text(m.get("APK_PATH")));
    }

    public static Email email() {
        JsonObject e = object(data(), "EMAIL");
        String server = text(e.get("IMAP_HOST"));
        return new Email(server.isBlank() ? "imap.gmail.com" : server, text(e.get("MAILBOX")), text(e.get("SENDER")));
    }

    // ---- reading ----

    private static String address(String key) {
        JsonObject envs = object(data(), "ENVIRONMENTS");
        for (Map.Entry<String, JsonElement> e : envs.entrySet()) {
            if (e.getKey().equalsIgnoreCase(env) && e.getValue().isJsonObject()) {
                return text(e.getValue().getAsJsonObject().get(key));
            }
        }
        return "";
    }

    private static JsonObject data() {
        JsonObject s = snapshot;
        if (s != null) return s;
        synchronized (TestData.class) {
            if (snapshot == null) snapshot = read();
            return snapshot;
        }
    }

    private static JsonObject read() {
        String fromEnv = System.getenv("FIA_CREDENTIALS_FILE"); TrovaRun.require(); // TICKET-1021: only a run Trova started
        Path file = Path.of(fromEnv != null && !fromEnv.isBlank() ? fromEnv : "data/credentials.json");
        if (!Files.isRegularFile(file)) {
            throw new IllegalStateException("No test data for this run: run the suite from Trova - it gives each run its"
                    + " environment's addresses, API headers and the rest from Test Data");
        }
        try {
            JsonElement root = JsonParser.parseString(Files.readString(file, StandardCharsets.UTF_8));
            JsonElement data = root.isJsonObject() ? root.getAsJsonObject().get("testData") : null;
            return data != null && data.isJsonObject() ? data.getAsJsonObject() : new JsonObject();
        } catch (Exception e) {
            throw new IllegalStateException("The run's test data could not be read: " + e.getMessage(), e);
        }
    }

    private static JsonObject object(JsonObject parent, String key) {
        JsonElement e = parent == null ? null : parent.get(key);
        return e != null && e.isJsonObject() ? e.getAsJsonObject() : new JsonObject();
    }

    private static String text(JsonElement e) {
        return e == null || e.isJsonNull() ? "" : e.getAsString();
    }
}
