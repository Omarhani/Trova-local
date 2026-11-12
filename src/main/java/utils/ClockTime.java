package utils;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Omar 2026-10-30 (AI sessions 418-423, Availo Plans / shifts): the time a test asks for ("18:00", "6 pm", "6:30 PM",
 * Arabic digits and ص / م) read once into what a clock dialog needs - the 12-hour number, AM / PM, the two-digit
 * header - and compared with what the field shows afterwards ("6:00 pm" or "18:00" are the same time). Used by TimePicker.
 */
public final class ClockTime {

    private static final Pattern TIME = Pattern.compile("(\\d{1,2})(?:\\s*[:.]\\s*(\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.|ص|م)?");

    private final int hour24;
    private final int minute;

    private ClockTime(int hour24, int minute) {
        this.hour24 = hour24;
        this.minute = minute;
    }

    /** the time in {@code text}; a wrong one fails in plain words ("\"25:00\" is not a time ...") */
    public static ClockTime parse(String text) {
        ClockTime t = read(text);
        if (t == null) throw new IllegalArgumentException("\"" + text + "\" is not a time - write it like 18:00 or 6:00 pm");
        return t;
    }

    /** true when the field's {@code shown} value is this same time in any writing; false for an empty or other value */
    public boolean matches(String shown) {
        ClockTime t = read(shown);
        return t != null && t.hour24 == hour24 && t.minute == minute;
    }

    private static ClockTime read(String text) {
        if (text == null) return null;
        Matcher m = TIME.matcher(western(text).strip().toLowerCase(Locale.ROOT));
        if (!m.matches()) return null;
        int hour = Integer.parseInt(m.group(1));
        int minute = m.group(2) == null ? 0 : Integer.parseInt(m.group(2));
        String half = m.group(3);
        if (minute > 59) return null;
        if (half == null) return hour > 23 ? null : new ClockTime(hour, minute);
        if (hour < 1 || hour > 12) return null; // Omar 2026-10-30: "13:00 pm" / "0:00 am" are not 12-hour times
        boolean pm = half.startsWith("p") || half.equals("م");
        return new ClockTime(hour % 12 + (pm ? 12 : 0), minute);
    }

    /** Arabic-Indic digits as 0-9 */
    private static String western(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (char c : s.toCharArray()) b.append(c >= '٠' && c <= '٩' ? (char) ('0' + c - '٠') : c);
        return b.toString();
    }

    public int hour24() {
        return hour24;
    }

    public int minute() {
        return minute;
    }

    /** the hour on a 12-hour clock: 1-12 (midnight and noon = 12) */
    public int hour12() {
        return hour24 % 12 == 0 ? 12 : hour24 % 12;
    }

    public boolean pm() {
        return hour24 >= 12;
    }

    /** the hour as the dialog's header shows it ("09", "12") */
    public String hourHeader() {
        return String.format(Locale.ROOT, "%02d", hour12());
    }

    public String minuteHeader() {
        return String.format(Locale.ROOT, "%02d", minute);
    }

    /** on a 24-hour face 1-12 sit on the outer ring, 13-23 and 00 on the inner one */
    public boolean innerRing24() {
        return hour24 == 0 || hour24 > 12;
    }

    /** where {@code value} out of {@code full} sits on a face of {@code radius} px: {x, y} from its centre (12 / 0 = the top) */
    public static int[] offset(int value, int full, double radius) {
        double angle = 2 * Math.PI * (value % full) / full;
        return new int[]{(int) Math.round(radius * Math.sin(angle)), (int) Math.round(-radius * Math.cos(angle))};
    }

    @Override
    public String toString() {
        return String.format(Locale.ROOT, "%d:%02d %s", hour12(), minute, pm() ? "pm" : "am");
    }
}
