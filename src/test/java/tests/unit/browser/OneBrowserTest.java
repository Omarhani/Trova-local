package tests.unit.browser;

import base.OneBrowser;
import org.openqa.selenium.WebDriver;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import static org.testng.Assert.*;

/** Run 209: every case started its own Chrome; one browser now serves the whole run, cleaned between cases. */
public class OneBrowserTest {

    private int started;

    private WebDriver start(FakeBrowser b) {
        started++;
        return b.driver();
    }

    @BeforeMethod
    public void fresh() {
        started = 0;
    }

    @AfterMethod
    public void end() {
        OneBrowser.close();
        System.clearProperty("oneBrowser");
    }

    @Test
    public void theSecondBlockOfARunGetsTheSameBrowserCleaned() {
        FakeBrowser b = new FakeBrowser();
        WebDriver first = OneBrowser.take("Chrome", () -> start(b));
        assertTrue(OneBrowser.keep(first), "the block's end leaves it open");
        WebDriver second = OneBrowser.take("Chrome", () -> start(b));
        assertSame(second, first);
        assertEquals(started, 1);
        assertTrue(b.calls.contains("deleteAllCookies"), "the next case starts without the last one's cookies");
        assertTrue(b.calls.stream().anyMatch(c -> c.contains("localStorage.clear()")), "and without its storage");
        assertTrue(b.calls.contains("get about:blank"));
    }

    @Test
    public void anotherBrowserTypeStartsANewOneAndClosesTheOld() {
        FakeBrowser chrome = new FakeBrowser();
        FakeBrowser edge = new FakeBrowser();
        OneBrowser.take("Chrome", () -> start(chrome));
        OneBrowser.take("Edge", () -> start(edge));
        assertEquals(started, 2);
        assertTrue(chrome.calls.contains("quit"));
    }

    @Test
    public void aBrowserThatDiedIsReplaced() {
        FakeBrowser b = new FakeBrowser();
        OneBrowser.take("Chrome", () -> start(b));
        b.alive = false;
        FakeBrowser fresh = new FakeBrowser();
        WebDriver next = OneBrowser.take("Chrome", () -> start(fresh));
        assertEquals(started, 2);
        assertNotNull(next);
    }

    @Test
    public void switchedOffEveryBlockGetsItsOwnBrowser() {
        System.setProperty("oneBrowser", "off");
        FakeBrowser b = new FakeBrowser();
        WebDriver first = OneBrowser.take("Chrome", () -> start(b));
        assertFalse(OneBrowser.keep(first));
        OneBrowser.take("Chrome", () -> start(new FakeBrowser()));
        assertEquals(started, 2);
    }

    @Test
    public void theRunsEndClosesIt() {
        FakeBrowser b = new FakeBrowser();
        OneBrowser.take("Chrome", () -> start(b));
        OneBrowser.close();
        assertTrue(b.calls.contains("quit"));
    }
}
