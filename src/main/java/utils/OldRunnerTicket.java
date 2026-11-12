package utils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * TICKET-1021: a run of a runner older than the run pass (version 8). Its data file carries Trova's ticket ("trovaCheck":
 * address, run, ticket) only while Trova does not require passes yet; the run goes on when Trova says yes to it. Without
 * a ticket, or when Trova says no, {@link TrovaRun} refuses as before.
 */
final class OldRunnerTicket {

    private OldRunnerTicket() {
    }

    static boolean allowed() {
        try {
            Path file = Path.of(System.getProperty("credentialsFile", "data/credentials.json"));
            if (!Files.isRegularFile(file)) return false;
            JsonElement root = JsonParser.parseString(Files.readString(file, StandardCharsets.UTF_8));
            JsonElement check = root.isJsonObject() ? root.getAsJsonObject().get("trovaCheck") : null;
            if (check == null || !check.isJsonObject()) return false;
            JsonObject c = check.getAsJsonObject();
            String url = c.get("url").getAsString().replaceAll("/+$", "") + "/api/public/run-pass/ticket?runId=" + c.get("runId").getAsLong();
            HttpURLConnection http = (HttpURLConnection) URI.create(url).toURL().openConnection();
            http.setRequestMethod("POST");
            http.setRequestProperty("X-Trova-Run-Ticket", c.get("ticket").getAsString());
            http.setConnectTimeout(15_000);
            http.setReadTimeout(15_000);
            http.setDoOutput(true);
            http.getOutputStream().close();
            return http.getResponseCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }
}
