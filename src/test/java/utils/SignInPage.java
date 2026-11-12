package utils;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import java.util.Map;

/**
 * Trova (Omar 2026-10-23, Test 8094 run 115) - where a sign-in page stands, read the way the AI agent reads it
 * (agent-tools trova-login-field.js and trova-login-signed.js), so a run and an AI session agree:
 * <ul>
 *   <li>signed in = off the sign-in page (no password box, no code box, off a login address) AND the login's done sign
 *   shows - a part of the address, a selector, or its words anywhere on the page (Arabic letter forms, tatweel and
 *   spaces do not matter; "text=لوحة الأداء" is words, never CSS) - OR the page has the signed-in shell (side menu /
 *   user menu);</li>
 *   <li>a saved step whose box is gone is found again by its kind: the code (OTP) box inside the open dialog, never the
 *   account-code box; a click whose button is gone is the open dialog's confirm button.</li>
 * </ul>
 * Never reads or logs a value.
 */
final class SignInPage {

    /** the shared page helpers (trova-login-field.js HELPERS) */
    private static final String HELPERS = """
            var DIALOG = '[role=dialog], [role=alertdialog], dialog[open], .modal.show, .modal.in, .mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane, .swal2-popup, .ant-modal, .p-dialog, .el-dialog';
            var OTP = /otp|one-time-code|one.?time|verif|code|pin|رمز|تحقق/i;
            var seen = function (e) { var r = e.getBoundingClientRect(); var s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.disabled; };
            var boxes = function () { return Array.prototype.slice.call(document.querySelectorAll('input, textarea')).filter(function (e) {
              return seen(e) && !e.readOnly && ['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].indexOf(e.type) < 0; }); };
            var words = function (e) { return [e.name, e.id, e.placeholder, e.getAttribute('aria-label'), e.getAttribute('formcontrolname'), e.autocomplete,
              e.labels && e.labels[0] && e.labels[0].innerText].filter(Boolean).join(' '); };
            var ACCOUNT = /account|company|client|org|tenant|user|e-?mail|حساب|منشأة|شركة|اسم|المستخدم/i;
            var STRONG = /otp|one-time-code|one.?time|verif|تحقق|sms/i;
            var otpLike = function (e) { return e.autocomplete === 'one-time-code' || (!ACCOUNT.test(words(e))
              && (STRONG.test(words(e)) || (OTP.test(words(e)) && !!e.closest(DIALOG)) || e.maxLength === 1)); };
            """;

    /** {pw, login, path, mid}: a password box, a login address, a code box half-way through the sign-in */
    private static final String STATE = HELPERS + """
            var all = boxes(); var path = location.pathname + location.hash;
            var login = /(^|[/#])(log-?in|sign-?in|signin|auth|sso)([/?#]|$)/i.test(path);
            var dialogCode = Array.prototype.slice.call(document.querySelectorAll(DIALOG)).filter(seen).some(function (d) {
              return /رمز|تحقق|otp|code|verif/i.test(d.innerText || '') && all.some(function (e) { return d.contains(e); }); });
            return { pw: all.some(function (e) { return e.type === 'password'; }), login: login, path: path, host: location.host,
              mid: dialogCode || all.some(function (e) { return otpLike(e) && (e.closest(DIALOG) || login); }) };
            """;

    /** the done sign shows: arguments[0] = done, [1] = its words; the agent's finder for a selector */
    private static final String DONE = "var find = function () { " + ScreenSignIn.FIND + " };" + """
            var d = arguments[0]; if (location.href.indexOf(d) >= 0) return true;
            try { if (find.apply(null, [d])) return true; } catch (e) { /* not a selector */ }
            var norm = function (s) { return String(s || '').normalize('NFKC').replace(/[\\u064B-\\u065F\\u0670\\u0640]/g, '')
              .replace(/[\\u0623\\u0625\\u0622\\u0671]/g, '\\u0627').replace(/\\u0629/g, '\\u0647').replace(/\\u0649/g, '\\u064A')
              .replace(/\\s+/g, '').toLowerCase(); };
            var want = norm(arguments[1]);
            return want.length > 1 && norm(document.body ? document.body.innerText : '').indexOf(want) >= 0;
            """;

    /** the signed-in shell: a side menu with links, else a user menu */
    private static final String SHELL = """
            var seen = function (e) { var r = e.getBoundingClientRect(); var s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
            var links = function (e) { return Array.prototype.slice.call(e.querySelectorAll('a[href], [routerlink], [role=menuitem], li')).filter(seen).length; };
            var MENU = ['aside', 'mat-sidenav', '.sidebar', '.side-menu', '.sidenav', '.side-nav', '[class*=sidebar]', '[class*=side-menu]', '[class*=sidenav]', 'nav', '[role=navigation]'];
            var USER = ['[class*=user-menu]', '[class*=user-info]', '[class*=user-profile]', '[class*=avatar]', '[aria-label*=account i]', '[aria-label*=profile i]'];
            for (var i = 0; i < MENU.length; i++) { if (Array.prototype.slice.call(document.querySelectorAll(MENU[i])).some(function (x) { return seen(x) && links(x) >= 3; })) return MENU[i]; }
            for (var j = 0; j < USER.length; j++) { if (Array.prototype.slice.call(document.querySelectorAll(USER[j])).some(seen)) return USER[j]; }
            return null;
            """;

    /** a selector for the box of this kind (dialog first): arguments[0] = otp | password | other, [1] = the field's name */
    private static final String PICK = HELPERS + """
            var fam = arguments[0], name = arguments[1];
            var all = boxes(); var inDialog = all.filter(function (e) { return e.closest(DIALOG); });
            var names = String(name).toLowerCase().split(/[^\\p{L}\\p{N}]+/u).filter(function (w) { return w.length > 1; });
            var pick = fam === 'otp' ? all.find(function (e) { return e.autocomplete === 'one-time-code'; }) || all.find(function (e) { return otpLike(e) && !e.value; })
                || inDialog.find(function (e) { return !e.value && !ACCOUNT.test(words(e)); })
              : fam === 'password' ? all.find(function (e) { return e.type === 'password' && !e.value; }) || all.find(function (e) { return e.type === 'password'; })
              : all.find(function (e) { return names.some(function (w) { return words(e).toLowerCase().indexOf(w) >= 0; }); }) || inDialog.find(function (e) { return !e.value; });
            if (!pick) return null;
            var tag = pick.tagName.toLowerCase(); var q = function (v) { return JSON.stringify(String(v)); };
            var tries = [pick.id && '#' + CSS.escape(pick.id),
              pick.getAttribute('formcontrolname') && tag + '[formcontrolname=' + q(pick.getAttribute('formcontrolname')) + ']',
              pick.name && tag + '[name=' + q(pick.name) + ']',
              pick.autocomplete === 'one-time-code' && tag + '[autocomplete="one-time-code"]',
              pick.placeholder && tag + '[placeholder=' + q(pick.placeholder) + ']',
              pick.getAttribute('aria-label') && tag + '[aria-label=' + q(pick.getAttribute('aria-label')) + ']']
              .concat(pick.closest(DIALOG) ? DIALOG.split(', ').map(function (d) { return d + ' ' + tag + (pick.type ? '[type=' + pick.type + ']' : ''); }) : []);
            for (var i = 0; i < tries.length; i++) { if (!tries[i]) continue; try { if (document.querySelector(tries[i]) === pick) return tries[i]; } catch (e) { /* not CSS */ } }
            return null;
            """;

    /** the confirm button of the open dialog: its text (clicked when arguments[0] is true), or null */
    private static final String BUTTON = HELPERS + """
            var scope = Array.prototype.slice.call(document.querySelectorAll(DIALOG)).filter(seen).pop(); if (!scope) return null;
            var NO = /إلغاء|الغاء|اغلاق|إغلاق|cancel|close|back|رجوع|إعادة|اعادة|resend/i;
            var YES = /إرسال|ارسال|تأكيد|تاكيد|تحقق|دخول|متابعة|التالي|submit|send|verify|confirm|continue|next|ok|log ?in|sign ?in/i;
            var text = function (b) { return (b.innerText || b.value || '').trim(); };
            var list = Array.prototype.slice.call(scope.querySelectorAll('button, input[type=submit], [role=button]')).filter(function (b) { return seen(b) && !NO.test(text(b)); });
            var b = list.find(function (x) { return x.type === 'submit'; }) || list.find(function (x) { return YES.test(text(x)); }) || list.filter(function (x) { return text(x); }).pop();
            if (!b || !text(b)) return null; if (arguments[0]) b.click(); return text(b);
            """;

    private SignInPage() {
    }

    /** a done the AI gave that names nothing on the page: "true", "done", empty ... (trova-login-done.js) */
    static boolean meaningless(String done) {
        return done == null || done.matches("(?i)^\\s*(true|false|yes|no|done|ok|1|0)?\\s*$");
    }

    /**
     * Is the page signed in now? null when it is, else what is wrong in plain words. {@code start} = the recipe's own
     * sign-in address (being on it is never signed in).
     */
    @SuppressWarnings("unchecked")
    static String signedIn(WebDriver driver, String done, String start) {
        JavascriptExecutor js = (JavascriptExecutor) driver;
        Map<String, Object> s;
        try {
            s = (Map<String, Object>) js.executeScript(STATE);
        } catch (Exception e) {
            return "the page could not be read";
        }
        if (s == null) return "the page could not be read";
        if (Boolean.TRUE.equals(s.get("pw")) || Boolean.TRUE.equals(s.get("login"))) return "the app showed its sign-in page";
        if (Boolean.TRUE.equals(s.get("mid"))) return "the app still asks for its code";
        String startPath = pathOf(start);
        if (!startPath.isEmpty() && !startPath.matches("^/?#?/?$") && startPath.equals(s.get("path"))) return "the app stayed on its sign-in page";
        if (doneShows(js, done)) return null;
        if (shell(js) != null) return null;
        return meaningless(done) ? null : "the signed-in page did not show (" + done + ")";
    }

    /** the signed-in shell's selector (side menu / user menu), or null */
    static String shell(JavascriptExecutor js) {
        try {
            Object s = js.executeScript(SHELL);
            return s instanceof String str ? str : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** a selector for the login field's box now on the page (found by its kind), or null */
    static String pick(WebDriver driver, String field) {
        try {
            Object s = ((JavascriptExecutor) driver).executeScript(PICK, family(field), String.valueOf(field == null ? "" : field));
            return s instanceof String str ? str : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** the open dialog's confirm button text (pressed when {@code click}), or null */
    static String button(WebDriver driver, boolean click) {
        try {
            Object s = ((JavascriptExecutor) driver).executeScript(BUTTON, click);
            return s instanceof String str ? str : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** mid-sign-in: a password box or a code box is on the page */
    @SuppressWarnings("unchecked")
    static boolean midSignIn(WebDriver driver) {
        try {
            Map<String, Object> s = (Map<String, Object>) ((JavascriptExecutor) driver).executeScript(STATE);
            return s == null || Boolean.TRUE.equals(s.get("pw")) || Boolean.TRUE.equals(s.get("mid"));
        } catch (Exception e) {
            return true;
        }
    }

    /** the kind of a login field by its name: password, otp, or other (an account code is not an OTP) */
    static String family(String field) {
        String f = field == null ? "" : field;
        if (f.matches("(?is).*(pass|pwd|كلمة).*")) return "password";
        if (f.matches("(?is).*(account|company|client|org|tenant|حساب|منشأة|شركة).*")) return "other";
        if (f.matches("(?is).*(otp|one.?time|code|verif|pin|sms|رمز|تحقق).*")) return "otp";
        return "other";
    }

    private static boolean doneShows(JavascriptExecutor js, String done) {
        String d = done == null ? "" : done.trim();
        if (meaningless(d)) return false;
        java.util.regex.Matcher t = java.util.regex.Pattern.compile("(?s)^text=(.+)$").matcher(d);
        java.util.regex.Matcher h = java.util.regex.Pattern.compile("(?s):has-text\\((['\"])(.*)\\1\\)$").matcher(d);
        String text = t.find() ? t.group(1) : h.find() ? h.group(2) : d.matches("(?s).*[^\\x00-\\x7f].*") ? d : "";
        text = text.trim().replaceAll("^['\"]|['\"]$", "");
        try {
            return Boolean.TRUE.equals(js.executeScript(DONE, d, text));
        } catch (Exception e) {
            return false;
        }
    }

    private static String pathOf(String url) {
        try {
            java.net.URI u = java.net.URI.create(url);
            return (u.getPath() == null ? "" : u.getPath()) + (u.getFragment() == null ? "" : "#" + u.getFragment());
        } catch (Exception e) {
            return "";
        }
    }
}
