package utils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Omar 2026-10-27 (the run page showed "Made pending overtime request 436055 (id 121, 1 hour, 31/10, reason ...)"): a
 * precondition step reads only "Pre-condition - API &lt;endpoint&gt;: &lt;action&gt;" - never ids, values, reasons or stamps.
 * "POST /api/v1/overtimeRequests/Create?x=1" → "Pre-condition - API overtimeRequests/Create: Create overtime request".
 */
public final class PreconditionWords {

    private PreconditionWords() {
    }

    /** the one plain line; endpoint null = made another way: "Pre-condition - &lt;record&gt; made" */
    public static String line(String endpoint, String record) {
        String path = shortPath(endpoint);
        String what = record == null || record.isBlank() ? "the record" : record.trim().replaceAll("\\s+\\d[\\w-]*", "");
        if (path == null) return "Pre-condition - " + what + " made";
        String action = action(path);
        return "Pre-condition - API " + path + ": " + (action != null ? action : capital(what));
    }

    /** the last two parts of the address, no method, query, ids or address */
    static String shortPath(String endpoint) {
        if (endpoint == null || endpoint.isBlank()) return null;
        String p = endpoint.trim().replaceFirst("^(?i)(GET|POST|PUT|PATCH|DELETE)\\s+", "").replaceFirst("^[a-z]+://[^/]+", "")
                .replaceFirst("[?#].*$", "");
        List<String> parts = new ArrayList<>();
        for (String s : p.split("/")) {
            if (s.isBlank() || s.matches("(?i)api|v\\d+|\\d+|[0-9a-f-]{16,}|\\{.*}")) continue;
            parts.add(s);
        }
        if (parts.isEmpty()) return null;
        return String.join("/", parts.subList(Math.max(0, parts.size() - 2), parts.size()));
    }

    /** "overtimeRequests/Create" → "Create overtime request"; null when the last part is no action word */
    static String action(String path) {
        String[] parts = path.split("/");
        if (parts.length < 2) return null;
        String verb = words(parts[1]);
        if (!verb.matches("(?i)(create|add|new|make|submit|send|save|request|insert|register|post)\\b.*")) return null;
        String noun = words(parts[0]).toLowerCase(Locale.ROOT);
        if (noun.endsWith("ies")) noun = noun.substring(0, noun.length() - 3) + "y";
        else if (noun.endsWith("s") && !noun.endsWith("ss")) noun = noun.substring(0, noun.length() - 1);
        return capital(verb.toLowerCase(Locale.ROOT)) + " " + noun;
    }

    /** "overtimeRequests" → "overtime Requests", "leave_types" → "leave types" */
    private static String words(String part) {
        return part.replaceAll("([a-z])([A-Z])", "$1 $2").replaceAll("[_-]+", " ").trim();
    }

    private static String capital(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
