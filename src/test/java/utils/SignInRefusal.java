package utils;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Trova (Omar 2026-10-23) - a refused sign-in in plain words, with the app's own reason: "Availo refused: you don't have
 * permission to sign in". Only a wrong user name / password points to Test Data → Credentials; an app API that refuses
 * a sign-in without its fixed headers points to Test Data → Environments → API headers. For an API client's sign-in:
 * {@code throw new IllegalStateException(SignInRefusal.words("Availo", answer.get("Message").getAsString(), true))}.
 */
public final class SignInRefusal {

    private static final Pattern WRONG_LOGIN = Pattern.compile("(?i)(invalid|incorrect|wrong|bad).{0,30}(user|password|credential|login)"
            + "|(user|password|credential).{0,30}(invalid|incorrect|wrong|not match)|كلمة (ال)?مرور|اسم المستخدم|بيانات الدخول (غير|خاطئ)");
    private static final Pattern NO_PERMISSION = Pattern.compile("(?i)permission|not allowed|unauthori[sz]ed|forbidden|\\b40[13]\\b|صلاحي|لا ?تملك|غير مصرح");
    private static final Pattern HEADERS = Pattern.compile("(?i)header|service ?key|client ?key|api ?key|request ?version");
    private static final Pattern CODE_TOO_SOON_AR = Pattern.compile("(لا ?يمكن(ك)?|لايمكن(ك)?) ?(إ|ا)عادة (ال)?(إ|ا)رسال.{0,40}(قبل|حتى)");
    private static final Pattern CODE_TOO_SOON = Pattern.compile("(?i)(cannot|can't|can not|not allowed to) (re-?send|send a new|request a new).{0,40}(before|until|yet)"
            + "|one-time code cannot be sent before");
    /** the app's words in Arabic that are common enough to say in English */
    private static final Map<Pattern, String> ARABIC = new LinkedHashMap<>();

    static {
        ARABIC.put(Pattern.compile("لا ?تملك صلاحية (ل)?تسجيل الدخول"), "you don't have permission to sign in");
        ARABIC.put(Pattern.compile("لا ?تملك صلاحية"), "you don't have permission");
        ARABIC.put(Pattern.compile("(اسم المستخدم|كلمة (ال)?مرور).*(غير صحيح|خاطئ)"), "wrong user name or password");
        ARABIC.put(Pattern.compile("الحساب (مقفل|موقوف)"), "the account is locked");
        ARABIC.put(CODE_TOO_SOON_AR, "a new one-time code cannot be sent before the last one runs out");
    }

    /**
     * Omar 2026-10-25: the app will not send a new one-time code yet (a sign-in just before asked for one) - waiting for
     * the old code to run out and trying once more gets through
     */
    public static boolean codeTooSoon(String said) {
        return said != null && (CODE_TOO_SOON_AR.matcher(said).find() || CODE_TOO_SOON.matcher(said).find());
    }

    private SignInRefusal() {
    }

    /**
     * @param app     the app's name ("Availo")
     * @param said    what the app answered (its message), "" when it said nothing
     * @param byApi   the sign-in was an API call (then missing fixed headers are a likely cause)
     */
    public static String words(String app, String said, boolean byApi) {
        String reason = said == null ? "" : said.replaceAll("\\s+", " ").replaceAll("(?i)^.*?refused the (call( \\S+)?|sign-in):\\s*", "") // Omar 2026-10-27: no call names
                .replaceAll("^\"|\"$", "").trim();
        String english = reason;
        for (Map.Entry<Pattern, String> a : ARABIC.entrySet()) {
            if (a.getKey().matcher(reason).find()) {
                english = a.getValue();
                break;
            }
        }
        String who = app == null || app.isBlank() ? "The app" : app;
        if (reason.isEmpty()) {
            // Omar 2026-10-26: no app message = it did not get through, never "refused" and never the login's fault
            return "The sign-in did not get through - try again" + (byApi && noHeaders()
                    ? " - the app's API needs its fixed headers: add them in Test Data → Environments → API headers" : "");
        }
        String refused = who + " refused: " + english + (english.equals(reason) ? "" : " (\"" + reason + "\")");
        if (WRONG_LOGIN.matcher(reason).find()) return refused + " - fix the login in Test Data → Credentials";
        if (byApi && noHeaders() && (HEADERS.matcher(reason).find() || NO_PERMISSION.matcher(reason).find())) {
            return refused + " - the app's API needs its fixed headers: add them in Test Data → Environments → API headers";
        }
        return refused;
    }

    private static boolean noHeaders() {
        try {
            return TestData.apiHeaders().isEmpty();
        } catch (Exception e) {
            return true;
        }
    }
}
