package tests.unit.browser;

import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import utils.BrowserViewport;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.testng.Assert.*;

/** Run 209: Chrome opened too narrow, Availo took its small-screen layout and its side menu covered buttons. */
public class BrowserViewportTest {

    private final List<Map<String, Object>> overrides = new ArrayList<>();
    private int[] reported;

    @BeforeMethod
    public void narrowWindow() {
        overrides.clear();
        reported = new int[]{1280, 650};
    }

    private BrowserViewport.Cdp cdp() {
        return (command, values) -> {
            assertEquals(command, "Emulation.setDeviceMetricsOverride");
            overrides.add(values);
            reported = new int[]{((Number) values.get("width")).intValue(), ((Number) values.get("height")).intValue()};
            return Map.of();
        };
    }

    private FakeBrowser browser() {
        FakeBrowser b = new FakeBrowser();
        b.scripts = s -> List.of((long) reported[0], (long) reported[1]);
        return b;
    }

    @AfterMethod
    public void noOwnSize() {
        System.clearProperty("windowSize");
    }

    @Test
    public void aStartedWebRunsBrowserReports1920x1080() {
        FakeBrowser b = browser();
        BrowserViewport.fix((org.openqa.selenium.JavascriptExecutor) b.driver(), cdp());
        assertEquals(reported, new int[]{1920, 1080});
        assertEquals(overrides.get(0).get("deviceScaleFactor"), 1);
        assertEquals(overrides.get(0).get("mobile"), false);
    }

    @Test
    public void aBrowserThatIsAlready1920x1080IsLeftAsItIs() {
        reported = new int[]{1920, 1080};
        BrowserViewport.fix((org.openqa.selenium.JavascriptExecutor) browser().driver(), cdp());
        assertTrue(overrides.isEmpty());
    }

    @Test
    public void theProjectsOwnBrowserSizeWins() {
        System.setProperty("windowSize", "1366x768");
        BrowserViewport.fix((org.openqa.selenium.JavascriptExecutor) browser().driver(), cdp());
        assertEquals(reported, new int[]{1366, 768});
    }

    @Test
    public void aWrongOwnSizeKeeps1920x1080() {
        System.setProperty("windowSize", "big");
        BrowserViewport.fix((org.openqa.selenium.JavascriptExecutor) browser().driver(), cdp());
        assertEquals(reported, new int[]{1920, 1080});
    }

    @Test
    public void aBrowserWithoutDevToolsIsNeverStopped() {
        BrowserViewport.fix((org.openqa.selenium.JavascriptExecutor) browser().driver(), (c, v) -> {
            throw new org.openqa.selenium.WebDriverException("not supported");
        });
        assertEquals(reported, new int[]{1280, 650});
    }
}
