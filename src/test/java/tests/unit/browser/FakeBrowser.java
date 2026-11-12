package tests.unit.browser;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import java.lang.reflect.Proxy;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

/** A stand-in browser for the helpers' own tests: answers scripts from a function and writes down every call. */
final class FakeBrowser {

    final List<String> calls = new ArrayList<>();
    /** script -> answer */
    Function<String, Object> scripts = s -> null;
    /** what get(url) does; null = loads at once */
    RuntimeException onGet;
    int getsThatFail = 0;
    Duration pageLoad = Duration.ofSeconds(30);
    boolean alive = true;

    WebDriver driver() {
        return (WebDriver) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{WebDriver.class, JavascriptExecutor.class},
                (proxy, m, args) -> switch (m.getName()) {
                    case "get" -> {
                        calls.add("get " + args[0]);
                        if (onGet != null && getsThatFail-- > 0) throw onGet;
                        yield null;
                    }
                    case "executeScript" -> {
                        calls.add("script " + args[0]);
                        yield scripts.apply(String.valueOf(args[0]));
                    }
                    case "manage" -> options();
                    case "getWindowHandles" -> {
                        if (!alive) throw new org.openqa.selenium.NoSuchSessionException("gone");
                        yield Set.of("w1");
                    }
                    case "getWindowHandle" -> "w1";
                    case "switchTo" -> Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{WebDriver.TargetLocator.class}, (p2, m2, a2) -> proxy);
                    case "getCurrentUrl" -> "https://app.example/home";
                    case "quit" -> {
                        calls.add("quit");
                        yield null;
                    }
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    case "toString" -> "FakeBrowser";
                    default -> null;
                });
    }

    private WebDriver.Options options() {
        return (WebDriver.Options) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{WebDriver.Options.class},
                (proxy, m, args) -> switch (m.getName()) {
                    case "timeouts" -> timeouts();
                    case "deleteAllCookies" -> {
                        calls.add("deleteAllCookies");
                        yield null;
                    }
                    default -> null;
                });
    }

    private WebDriver.Timeouts timeouts() {
        return (WebDriver.Timeouts) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{WebDriver.Timeouts.class},
                (proxy, m, args) -> switch (m.getName()) {
                    case "getPageLoadTimeout" -> pageLoad;
                    case "pageLoadTimeout" -> {
                        calls.add("pageLoadTimeout " + ((Duration) args[0]).toMillis());
                        yield proxy;
                    }
                    default -> proxy;
                });
    }
}
