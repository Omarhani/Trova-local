package utils;

import java.util.regex.Pattern;

/**
 * Trova TICKET-980 - the app's own calls (recorded by {@link NetworkRecorder}) that say the sign-in ran out: HTTP 401 /
 * 403 with a message about an expired or invalid token / session. Only the time is kept, never the message.
 */
final class SignOutSigns {

    private static final Pattern EXPIRED = Pattern.compile("(?i)(expire|invalid[ _-]?token|token[ _-]?(is[ _-]?)?(invalid|expired|missing)|jwt|unauthori[sz]ed|session|not[ _-]?authenticated|sign(ed)?[ _-]?in|log(ged)?[ _-]?in)");
    private static volatile long last;

    private SignOutSigns() {
    }

    static void note(int status, String body) {
        if ((status == 401 || status == 403) && (body == null || body.isBlank() ? status == 401 : EXPIRED.matcher(body).find())) {
            last = System.currentTimeMillis();
        }
    }

    /** an app's call said the sign-in ran out within the last {@code ms} */
    static boolean within(long ms) {
        return last > 0 && System.currentTimeMillis() - last <= ms;
    }
}
