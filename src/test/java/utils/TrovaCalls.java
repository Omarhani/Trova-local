package utils;

import io.restassured.response.Response;
import io.restassured.specification.FilterableRequestSpecification;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

/**
 * Trova DEF-375 - while an AI session runs the tests, Trova names a file in TROVA_API_CALLS: every API call the test code
 * makes is added to it as one JSON line (method, address, status, bodies with secrets masked), so the session's Add Info
 * lists them for the Endpoints page. Nothing happens when the variable is not set (a normal run).
 */
public final class TrovaCalls {

    private static final String FILE = System.getenv("TROVA_API_CALLS");
    private static final int MAX_BODY = 4000;

    private TrovaCalls() {
    }

    public static void record(FilterableRequestSpecification request, Response response) {
        if (FILE == null || FILE.isBlank()) {
            return;
        }
        try {
            Object body = request.getBody();
            String line = "{\"method\":" + quote(request.getMethod()) + ",\"url\":" + quote(request.getURI())
                    + ",\"status\":" + response.statusCode()
                    + ",\"requestBody\":" + quote(body == null ? null : ApiReport.mask(String.valueOf(body)))
                    + ",\"responseBody\":" + quote(ApiReport.mask(response.asString())) + "}" + System.lineSeparator();
            synchronized (TrovaCalls.class) {
                Files.writeString(Path.of(FILE), line, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            }
        } catch (IOException | RuntimeException e) {
            // never stops a test
        }
    }

    private static String quote(String s) {
        if (s == null) {
            return "null";
        }
        String v = s.length() > MAX_BODY ? s.substring(0, MAX_BODY) : s;
        StringBuilder out = new StringBuilder("\"");
        for (char c : v.toCharArray()) {
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
                }
            }
        }
        return out.append('"').toString();
    }
}
