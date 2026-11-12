package base;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.edge.EdgeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.safari.SafariDriver;
import utils.LiveFeed;
import utils.NetworkRecorder;

import java.util.Map;

/** Opens the run's browser: which one, its window size, its logs, and the driver from the cache. */
final class BrowserStart {

    /** run 209: Chrome slows a window that is hidden behind others - a test's page must never wait for that */
    private static final String[] AWAKE = {"--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
            "--disable-background-timer-throttling"};

    private BrowserStart() {
    }

    static WebDriver open(String browser) {
        String attach = System.getProperty("attachBrowser", "").trim();
        if (!attach.isEmpty() && !attach.startsWith("${")) {
            // -DattachBrowser=host:port: drive a Chrome that is already open (the platform's AI agent shares its browser
            // this way: the framework's own login runs in it, then the agent looks at the logged-in pages)
            ChromeOptions chromeOptions = new ChromeOptions();
            chromeOptions.setExperimentalOption("debuggerAddress", attach);
            return startWithCachedDriver("chromedriver", "webdriver.chrome.driver", () -> new ChromeDriver(chromeOptions));
        }
        if (browser.equalsIgnoreCase("Chrome") || browser.equalsIgnoreCase("${browserType}")) {
            return chrome("--window-size=" + windowWidth() + "," + windowHeight());
        } else if (browser.equalsIgnoreCase("Edge")) {
            return edge("--window-size=" + windowWidth() + "," + windowHeight());
        } else if (browser.equalsIgnoreCase("headlessChrome")) {
            return chrome(headless());
        } else if (browser.equalsIgnoreCase("headlessEdge")) {
            return edge(headless());
        } else if (browser.equalsIgnoreCase("Firefox") || browser.equalsIgnoreCase("headlessFirefox")) {
            // geckodriver - and Firefox itself when it is not installed - come from Selenium Manager's cache
            // (~/.cache/selenium/geckodriver, firefox). No DevTools: the Timeline shows the steps only and the GIF is
            // recorded with plain screenshots (BrowserGifRecorder / NetworkRecorder check the driver type).
            FirefoxOptions firefoxOptions = new FirefoxOptions();
            firefoxOptions.addArguments("--width=" + windowWidth(), "--height=" + windowHeight());
            if (browser.equalsIgnoreCase("headlessFirefox")) {
                firefoxOptions.addArguments("-headless");
            }
            if (LiveFeed.ON) {
                firefoxOptions.setCapability("webSocketUrl", true); // WebDriver BiDi: the platform's live screen
            }
            return startWithCachedDriver("geckodriver", "webdriver.gecko.driver", () -> new FirefoxDriver(firefoxOptions));
        } else if (browser.equalsIgnoreCase("Safari")) {
            // macOS only: Safari ships safaridriver (allow it once with `safaridriver --enable`); no headless mode, no DevTools
            if (System.getProperty("os.name").toLowerCase().contains("win")) {
                throw new IllegalArgumentException("browser=Safari needs macOS - Safari has no WebDriver on Windows");
            }
            return new SafariDriver();
        }
        throw new IllegalArgumentException("Unknown browser \"" + browser
                + "\": use Chrome, Edge, Firefox, Safari, headlessChrome, headlessEdge or headlessFirefox");
    }

    private static String[] headless() {
        return new String[]{
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--headless=new",
                "--disable-gpu",
                "--window-size=" + windowWidth() + "," + windowHeight(),
                // no fixed --remote-debugging-port: two headless runs on one agent machine would fight over it
                "--disable-extensions"
        };
    }

    private static WebDriver chrome(String... arguments) {
        ChromeOptions chromeOptions = new ChromeOptions();
        chromeOptions.addArguments(arguments);
        chromeOptions.addArguments(AWAKE); // Omar 2026-11-06: a window behind others is never slowed down
        logNetworkAndConsole(chromeOptions, ChromeOptions.LOGGING_PREFS);
        return startWithCachedDriver("chromedriver", "webdriver.chrome.driver", () -> new ChromeDriver(chromeOptions));
    }

    private static WebDriver edge(String... arguments) {
        EdgeOptions edgeOptions = new EdgeOptions();
        edgeOptions.addArguments(arguments);
        edgeOptions.addArguments(AWAKE);
        logNetworkAndConsole(edgeOptions, EdgeOptions.LOGGING_PREFS);
        return startWithCachedDriver("msedgedriver", "webdriver.edge.driver", () -> new EdgeDriver(edgeOptions));
    }

    /**
     * Starts a browser with the newest driver already in Selenium's cache (~/.cache/selenium/&lt;driver&gt;).
     * Without this, Selenium Manager looks the driver up online (googlechromelabs.github.io) on every start
     * and waits up to its 300 s timeout when that site is slow or unreachable - a 5 minute browser setup.
     * If the cached driver does not fit the installed browser (e.g. right after a browser update), it falls
     * back to Selenium Manager once, which downloads the right one.
     */
    private static WebDriver startWithCachedDriver(String driverName, String driverProperty,
                                                   java.util.function.Supplier<WebDriver> start) {
        if (System.getProperty(driverProperty) == null) {
            java.io.File[] versions = new java.io.File(System.getProperty("user.home"),
                    ".cache/selenium/" + driverName + "/" + platformFolder()).listFiles(java.io.File::isDirectory);
            String exe = driverName + (System.getProperty("os.name").toLowerCase().contains("win") ? ".exe" : "");
            java.util.Arrays.stream(versions == null ? new java.io.File[0] : versions)
                    .filter(v -> new java.io.File(v, exe).isFile())
                    .max(java.util.Comparator.comparing(v -> java.util.Arrays.stream(v.getName().split("\\."))
                            .map(p -> String.format("%06d", Integer.parseInt(p.replaceAll("\\D", "0"))))
                            .collect(java.util.stream.Collectors.joining("."))))
                    .ifPresent(v -> System.setProperty(driverProperty, new java.io.File(v, exe).getAbsolutePath()));
        }
        WebDriver started;
        try {
            started = start.get();
        } catch (org.openqa.selenium.SessionNotCreatedException e) {
            // cached driver is for another browser version - let Selenium Manager fetch the right one
            System.clearProperty(driverProperty);
            return start.get();
        }
        // A driver one version behind can still open a session (ChromeDriver 153 with Chrome 154) and then pages
        // hang ("Timed out receiving message from renderer"). Mismatched majors: close it and start once more
        // through Selenium Manager, which caches the matching driver, so the next start picks it straight away.
        String browserMajor = majorVersion(((org.openqa.selenium.HasCapabilities) started).getCapabilities().getBrowserVersion());
        String driverMajor = majorVersion(driverVersion(((org.openqa.selenium.HasCapabilities) started).getCapabilities()));
        if (!browserMajor.isEmpty() && !driverMajor.isEmpty() && !browserMajor.equals(driverMajor)) {
            System.out.println("⚠️ " + driverName + " " + driverMajor + " does not match the browser " + browserMajor
                    + " - restarting with the matching driver");
            started.quit();
            String cachedDriver = System.getProperty(driverProperty);
            System.clearProperty(driverProperty);
            try {
                return start.get();
            } catch (RuntimeException blocked) {
                // The matching driver could not run - e.g. Windows' Application Control blocked a freshly
                // downloaded driver on a build agent. Carry on with the cached one rather than failing.
                System.out.println("⚠️ The matching " + driverName + " could not start (" + String.valueOf(blocked.getMessage()).split("\n")[0]
                        + ") - using the cached " + driverMajor + " one. Allow the new driver on this machine to fix it.");
                if (cachedDriver != null) {
                    System.setProperty(driverProperty, cachedDriver);
                }
                return start.get();
            }
        }
        return started;
    }

    /** Selenium Manager's cache folder for this machine: win64, linux64, mac-x64 or mac-arm64. */
    private static String platformFolder() {
        String os = System.getProperty("os.name").toLowerCase();
        if (os.contains("win")) {
            return "win64";
        }
        if (os.contains("mac")) {
            return System.getProperty("os.arch").contains("aarch64") ? "mac-arm64" : "mac-x64";
        }
        return "linux64";
    }

    /** chromedriverVersion / msedgedriverVersion from the session's capabilities ("153.0.8010.52 (...)"). */
    private static String driverVersion(org.openqa.selenium.Capabilities capabilities) {
        // Firefox reports no driver version (geckodriver fits any Firefox from 78 on): the major check is skipped
        for (String browser : new String[]{"chrome", "msedge"}) {
            Object details = capabilities.getCapability(browser);
            if (details instanceof java.util.Map) {
                Object version = ((java.util.Map<?, ?>) details).get(browser.equals("chrome") ? "chromedriverVersion" : "msedgedriverVersion");
                if (version != null) {
                    return version.toString();
                }
            }
        }
        return "";
    }

    private static String majorVersion(String version) {
        return version == null ? "" : version.trim().replaceFirst("^(\\d+).*$", "$1").replaceAll("\\D.*", "");
    }

    /**
     * Chrome / Edge keep their DevTools Network events and the whole console (errors, warnings, info, logs), for the Timeline of each test's
     * report entry ({@link NetworkRecorder} reads them). Off with {@code -Dnetwork=off}.
     */
    private static void logNetworkAndConsole(org.openqa.selenium.chromium.ChromiumOptions<?> options, String loggingPrefs) {
        if (!NetworkRecorder.ENABLED) {
            return;
        }
        org.openqa.selenium.logging.LoggingPreferences logs = new org.openqa.selenium.logging.LoggingPreferences();
        logs.enable(org.openqa.selenium.logging.LogType.PERFORMANCE, java.util.logging.Level.ALL);
        logs.enable(org.openqa.selenium.logging.LogType.BROWSER, java.util.logging.Level.ALL);
        options.setCapability(loggingPrefs, logs);
        options.setExperimentalOption("perfLoggingPrefs", Map.of("enableNetwork", true, "enablePage", false));
    }

    /** Omar 2026-10-25: every run's browser is 1920x1080 unless the project sets its own size (-DwindowSize=WxH from Trova). */
    static int[] windowSize() {
        String v = System.getProperty("windowSize", "").trim();
        if (v.matches("\\d{3,4}x\\d{3,4}")) {
            String[] p = v.split("x");
            return new int[]{Integer.parseInt(p[0]), Integer.parseInt(p[1])};
        }
        return new int[]{1920, 1080};
    }

    static int windowWidth() {
        return windowSize()[0];
    }

    static int windowHeight() {
        return windowSize()[1];
    }

    /**
     * Chrome now and then hangs on a page load ("Timed out receiving message from renderer", 30 s) and the whole
     * block was skipped while every other block loaded the same page fine. Stop the stuck load and try once
     * more before failing.
     */
    static void openWithOneRetry(WebDriver driver, String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalStateException("No web address for the " + utils.TestData.env()
                    + " environment: add it in Trova → Test Data → Environments");
        }
        try {
            utils.SignedInRun.openPlain(driver, url); // Omar 2026-10-25: Test Data → Browser storage before the first page
        } catch (org.openqa.selenium.TimeoutException first) {
            System.out.println("⏳ Page load hung (" + first.getMessage().split("\n")[0] + ") - loading it again");
            try {
                ((org.openqa.selenium.JavascriptExecutor) driver).executeScript("window.stop();");
            } catch (Exception ignored) {
                // the renderer may not answer either; the second get decides
            }
            utils.SignedInRun.openPlain(driver, url);
        }
    }
}
