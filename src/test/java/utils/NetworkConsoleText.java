package utils;

import java.util.logging.Level;

/** A browser console line as the Timeline shows it: its words and its level. */
final class NetworkConsoleText {

    private static final java.util.regex.Pattern SOURCE = java.util.regex.Pattern.compile("^(\\S+) (\\d+:\\d+) \"(.*)\"$", java.util.regex.Pattern.DOTALL);

    /** Chrome's {@code https://app/main.js 12:345 "text"} as {@code text  (main.js 12:345)}; the page's own script loses the source */
    static String readable(String raw) {
        java.util.regex.Matcher m = SOURCE.matcher(raw);
        if (!m.matches()) return raw;
        String text = m.group(3).replace("\\\"", "\"");
        if ("console-api".equals(m.group(1))) return text;
        String file = m.group(1).replaceAll("[?#].*$", "").replaceAll("^.*/", "");
        return text + "  (" + (file.isEmpty() ? m.group(1) : file) + " " + m.group(2) + ")";
    }

    static String levelOf(Level level) {
        int v = level.intValue();
        return v >= Level.SEVERE.intValue() ? "error" : v >= Level.WARNING.intValue() ? "warning" : v >= Level.INFO.intValue() ? "info" : "log";
    }

    private NetworkConsoleText() {
    }
}
