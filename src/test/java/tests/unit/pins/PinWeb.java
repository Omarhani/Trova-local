package tests.unit.pins;

import org.openqa.selenium.Alert;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.Point;
import org.openqa.selenium.Rectangle;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Interactive;
import org.openqa.selenium.interactions.Sequence;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * A stand-in browser and phone that answer at once, so no wait ever depends on the clock: a covering layer is never
 * shown, a toast is there on the first look and gone on the next, and a look that polls is not written down.
 * It writes down every call that acts on the app, in order.
 */
final class PinWeb {

    /** the loading layers of utils.Covers: looked for before every action, as many times as the clock allows when shown */
    private static final String COVER = "By.cssSelector: ";

    final List<String> calls = new ArrayList<>();
    /** a locator that is on the page for one look only */
    final Set<String> vanishing = new HashSet<>();
    final Set<String> looked = new HashSet<>();
    /** the next click of an element goes stale, once */
    boolean staleOnce;
    /** typing is read back as typed */
    boolean valueEchoes;
    /** after a tap the old element is stale: the phone's screen changed */
    boolean tapChangesScreen = true;
    private final Set<String> staleElements = new HashSet<>();
    private int shot;

    /** a new step: what vanished is back */
    void nextStep() {
        looked.clear();
    }

    private static Object plainAnswer(Class<?> type) {
        if (type == boolean.class) return false;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        if (type == String.class) return "";
        if (type == List.class) return List.of();
        return null;
    }

    private static String shown(Object[] a) {
        return a == null ? "" : Arrays.deepToString(a);
    }

    WebElement element(String name) {
        return (WebElement) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{WebElement.class,
                org.openqa.selenium.WrapsDriver.class, org.openqa.selenium.interactions.Locatable.class},
                (p, m, a) -> elementCall(name, p, m, a));
    }

    private Object elementCall(String name, Object proxy, Method m, Object[] a) {
        return switch (m.getName()) {
            case "toString" -> "[[Fake] -> xpath: " + name + "]";
            case "hashCode" -> 1;
            case "equals" -> proxy == a[0];
            case "isDisplayed" -> true;
            case "isEnabled" -> {
                if (staleElements.contains(name)) throw new StaleElementReferenceException("redrawn");
                yield true;
            }
            case "isSelected" -> false;
            case "getText" -> "the text";
            case "getTagName" -> "select";
            case "getDomAttribute" -> "multiple".equals(a[0]) ? null : "index".equals(a[0]) ? "0" : "attr";
            case "getAttribute" -> valueEchoes && "value".equals(a[0]) ? "typed" : "attr";
            case "getDomProperty" -> "index".equals(a[0]) ? "0" : "attr";
            case "getRect" -> new Rectangle(1, 2, 30, 40);
            case "getLocation" -> new Point(1, 2);
            case "getSize" -> new Dimension(30, 40);
            case "findElements" -> List.of(element(name + "/option"));
            default -> {
                calls.add("element." + m.getName() + shown(a));
                if (m.getName().equals("click") && staleOnce) {
                    staleOnce = false;
                    throw new StaleElementReferenceException("redrawn");
                }
                yield plainAnswer(m.getReturnType());
            }
        };
    }

    /** every call of the stand-in browser or phone */
    Object driverCall(Object proxy, Method m, Object[] a) throws Exception {
        return switch (m.getName()) {
            case "toString" -> "FakeDriver";
            case "hashCode" -> 2;
            case "equals" -> proxy == a[0];
            case "findElement" -> find(a[0]);
            case "findElements" -> findAll(a[0]);
            case "executeScript" -> script(a);
            case "perform" -> perform(a);
            case "switchTo" -> targetLocator();
            case "manage" -> manage();
            case "getPageSource" -> "<x resource-id=\"success_snackbar\" content-desc=\"Saved, Saved\"/>";
            case "getCurrentPackage" -> "the.app";
            case "isKeyboardShown" -> true;
            case "getScreenshotAs" -> picture();
            // a wait that runs out names the session in its message
            case "getSessionId" -> new org.openqa.selenium.remote.SessionId("fake");
            case "getCapabilities" -> new org.openqa.selenium.ImmutableCapabilities();
            default -> {
                calls.add("driver." + m.getName() + shown(a));
                yield plainAnswer(m.getReturnType());
            }
        };
    }

    private Object find(Object by) {
        String name = String.valueOf(by);
        calls.add("find " + name);
        if (name.equals("By.id: gone") || (vanishing.contains(name) && !looked.add(name))) {
            throw new NoSuchElementException(name);
        }
        return element(name);
    }

    private Object findAll(Object by) {
        String name = String.valueOf(by);
        if (name.startsWith(COVER)) return List.of();
        calls.add("findAll " + name);
        return name.equals("By.id: gone") ? List.of() : List.of(element(name));
    }

    private Object script(Object[] a) {
        Object[] args = a.length > 1 && a[1] instanceof Object[] more ? more : Arrays.copyOfRange(a, 1, a.length);
        calls.add("script#" + String.valueOf(a[0]).hashCode() + " " + inOrder(Arrays.asList(args)));
        return "button \"Save\"";
    }

    private Object perform(Object[] a) {
        // Selenium keeps its input sources in a set without an order: sorted, so only what they do counts
        List<String> sequences = new ArrayList<>();
        for (Object s : (Collection<?>) a[0]) sequences.add(String.valueOf(inOrder(((Sequence) s).encode())));
        java.util.Collections.sort(sequences);
        calls.add("perform " + sequences);
        if (tapChangesScreen) staleElements.addAll(List.of("By.id: a"));
        return null;
    }

    /** a map's order changes from one start to the next (Map.of): always in key order here */
    private static Object inOrder(Object value) {
        if (value instanceof java.util.Map<?, ?> map) {
            java.util.TreeMap<String, Object> sorted = new java.util.TreeMap<>();
            map.forEach((k, v) -> sorted.put(String.valueOf(k), inOrder(v)));
            return sorted;
        }
        if (value instanceof Collection<?> list) {
            List<Object> out = new ArrayList<>();
            for (Object o : list) out.add(inOrder(o));
            return out;
        }
        return value;
    }

    private Object targetLocator() {
        return Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{WebDriver.TargetLocator.class}, (p, m2, a2) -> {
            if (!m2.getName().equals("alert")) return null;
            return Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{Alert.class}, (p3, m3, a3) -> {
                calls.add("alert." + m3.getName() + shown(a3));
                return m3.getReturnType() == String.class ? "alert text" : null;
            });
        });
    }

    private Object manage() {
        return Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{WebDriver.Options.class}, (p, m2, a2) -> {
            if (!m2.getName().equals("window")) return null;
            return Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{WebDriver.Window.class},
                    (p3, m3, a3) -> m3.getName().equals("getSize") ? new Dimension(1000, 2000) : null);
        });
    }

    /** a picture no two alike, as a browser's page that changes */
    private byte[] picture() throws Exception {
        BufferedImage image = new BufferedImage(40, 20, BufferedImage.TYPE_INT_RGB);
        image.setRGB(1, 1, ++shot * 4000);
        for (int x = 0; x < 40; x++) image.setRGB(x, 2, shot * 4000);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", out);
        return out.toByteArray();
    }

    /** the stand-in browser, not a DevTools one: a recording uses plain screenshots */
    WebDriver browser() {
        return (WebDriver) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{WebDriver.class, JavascriptExecutor.class,
                Interactive.class, TakesScreenshot.class}, this::driverCall);
    }
}
