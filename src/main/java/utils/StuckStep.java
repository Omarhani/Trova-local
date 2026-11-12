package utils;

import org.openqa.selenium.ElementClickInterceptedException;
import org.openqa.selenium.ElementNotInteractableException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;

/**
 * Omar 2026-10-25: what a stuck step does - asks for AI help ({@link AiHelpAsk}); helped = the step runs once more
 * from where the AI left the page; not helped = the test fails with the plain reason first (the original error kept).
 * Stuck = a time-out and (Omar 2026-10-25) a stale element, an element not clickable or a click something covered.
 */
final class StuckStep {

    private StuckStep() {
    }

    /** true for the failures AI help can get a step past */
    static boolean stuck(Throwable t) {
        return t instanceof TimeoutException || t instanceof StaleElementReferenceException
                || t instanceof ElementClickInterceptedException || t instanceof ElementNotInteractableException;
    }

    static void help(WebDriver driver, WebDriverException failed, Runnable step) {
        AiHelpAsk.Answer a = AiHelpAsk.ask(driver, failed);
        if (a == null) throw failed;
        if (!a.helped()) {
            if (a.why() == null || a.why().isBlank()) throw failed;
            throw same(a.why() + " - " + AiHelpAsk.firstLine(failed), failed);
        }
        try {
            step.run();
        } catch (WebDriverException again) {
            if (!stuck(again)) throw again;
            throw same("Still stuck after AI help (" + a.did() + ") - " + AiHelpAsk.firstLine(again), again);
        }
    }

    /** the same kind of failure, with the plain reason first */
    private static WebDriverException same(String why, WebDriverException cause) {
        return cause instanceof TimeoutException ? new TimeoutException(why, cause) : new WebDriverException(why, cause);
    }
}
