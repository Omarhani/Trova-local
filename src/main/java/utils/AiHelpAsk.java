package utils;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Omar 2026-10-25: a step stuck on something the code did not expect (an element not found, an unexpected dialog such
 * as the one-time-code box, a wait timing out) pauses the test instead of failing it: the line {@code @@live
 * {"t":"ai-help", ...}} asks Trova's runner, whose AI works in this same browser (over its DevTools address), and the
 * runner's answer comes back as {@code <liveDir>/ai-help-<n>.json}. The step is then tried once more. Only in a Trova
 * run ({@code -DaiHelp=on} and a live folder); elsewhere the step fails as it always did.
 */
public final class AiHelpAsk {

    /** helped = the AI got past it (did = what it did); else why = the plain reason for the test's failure, or null */
    public record Answer(boolean helped, String did, String why) {
    }

    static final long WAIT_MS = 150_000; // the runner gives the AI 2 minutes; a little more for its answer
    private static final Gson GSON = new Gson();
    private static final AtomicInteger N = new AtomicInteger();
    private static final List<String> NOT_OURS = List.of("utils.", "org.openqa.", "java.", "jdk.", "sun.", "org.testng.",
            "com.sun.", "io.qameta.", "org.apache.", "net.bytebuddy.");
    /** page code: a visible dialog asking for a one-time code (or a one-time-code box) */
    private static final String CODE_BOX = "return (() => { const DIALOG = '[role=dialog], [role=alertdialog], dialog[open], .modal.show, .mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane, .ant-modal, .p-dialog, .swal2-popup';"
            + " const seen = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };"
            + " if ([...document.querySelectorAll('input[autocomplete=\"one-time-code\"]')].some(seen)) return true;"
            + " return [...document.querySelectorAll(DIALOG)].filter(seen).some((d) => /رمز|تحقق|otp|one.?time|verif|code/i.test(d.innerText || '') && d.querySelector('input')); })();";

    private AiHelpAsk() {
    }

    static boolean on() {
        return "on".equalsIgnoreCase(System.getProperty("aiHelp", "off").trim()) && !System.getProperty("liveDir", "").isBlank();
    }

    /** asks the runner and waits for its answer; null = no AI help in this run */
    public static Answer ask(WebDriver driver, RuntimeException failed) {
        if (!on() || driver == null) return null;
        int n = N.incrementAndGet();
        String[] where = where();
        Path answer = Path.of(System.getProperty("liveDir").trim(), "ai-help-" + n + ".json");
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("t", "ai-help");
        event.put("at", System.currentTimeMillis());
        event.put("n", n);
        event.put("step", where[0]);
        event.put("test", where[1]);
        event.put("problem", firstLine(failed));
        event.put("url", safe(driver::getCurrentUrl));
        event.put("title", safe(driver::getTitle));
        event.put("codeBox", codeBox(driver));
        System.out.println("A step is stuck - the test waits while Trova's AI helps in this browser");
        System.out.println("@@live " + ascii(GSON.toJson(event)));
        long until = System.currentTimeMillis() + WAIT_MS;
        while (System.currentTimeMillis() < until) {
            try {
                if (Files.isRegularFile(answer)) {
                    JsonObject a = JsonParser.parseString(Files.readString(answer, StandardCharsets.UTF_8)).getAsJsonObject();
                    Files.deleteIfExists(answer);
                    boolean ok = a.has("ok") && a.get("ok").getAsBoolean();
                    String did = a.has("did") && !a.get("did").isJsonNull() ? a.get("did").getAsString() : "";
                    String why = a.has("why") && !a.get("why").isJsonNull() ? a.get("why").getAsString() : null;
                    if (ok) mark(where[0], did);
                    return new Answer(ok, did, why);
                }
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return null;
            } catch (Exception e) {
                // half-written answer: read it again
            }
        }
        return new Answer(false, "", "AI help did not answer within 2 minutes");
    }

    /** "AI helped: <what>" as a step of the test (live view, Timeline) and a line of its report */
    private static void mark(String step, String did) {
        String text = "AI helped: " + (did == null || did.isBlank() ? "got past the stuck step" : did); // the runner says it in the console
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("t", "step");
        event.put("at", System.currentTimeMillis());
        event.put("n", MethodHandlesWeb.currentStepNumber());
        event.put("a", "AI help");
        event.put("e", text);
        event.put("l", "");
        event.put("c", step);
        System.out.println("@@live " + ascii(GSON.toJson(event)));
        try { // the project's report entry, when its helpers have one open
            java.lang.reflect.Field f = MethodHandlesWeb.class.getDeclaredField("test");
            f.setAccessible(true);
            Object test = f.get(null);
            if (test != null) test.getClass().getMethod("info", String.class).invoke(test, text);
        } catch (Exception ignored) {
            // no report entry: the live step is enough
        }
    }

    /** [the page step that got stuck (LoginPage.clickSend), the test it belongs to] */
    static String[] where() {
        List<String> ours = StackWalker.getInstance().walk(s -> s
                .filter(f -> NOT_OURS.stream().noneMatch(p -> f.getClassName().startsWith(p)))
                .map(f -> f.getClassName().substring(f.getClassName().lastIndexOf('.') + 1) + "." + f.getMethodName())
                .toList());
        if (ours.isEmpty()) return new String[]{"a step", ""};
        return new String[]{ours.get(0), ours.get(ours.size() - 1)};
    }

    static String firstLine(Throwable failed) {
        String m = failed == null || failed.getMessage() == null ? "a wait ran out" : failed.getMessage();
        int cut = m.indexOf('\n');
        m = cut > 0 ? m.substring(0, cut) : m;
        return m.length() > 300 ? m.substring(0, 300) : m;
    }

    private static boolean codeBox(WebDriver driver) {
        try {
            return driver instanceof JavascriptExecutor js && Boolean.TRUE.equals(js.executeScript(CODE_BOX));
        } catch (Exception e) {
            return false;
        }
    }

    private static String safe(java.util.function.Supplier<String> read) {
        try {
            return read.get();
        } catch (Exception e) {
            return "";
        }
    }

    /** non-ASCII as \\uXXXX: Arabic survives any console encoding */
    static String ascii(String json) {
        StringBuilder out = new StringBuilder(json.length());
        for (char ch : json.toCharArray()) out.append(ch < 128 ? String.valueOf(ch) : String.format("\\u%04x", (int) ch));
        return out.toString();
    }
}
