package screens.base;

import io.appium.java_client.android.AndroidDriver;
import org.openqa.selenium.By;
import utils.MethodHandlesMobile;
import utils.WaitedReads;

/** Parent of every phone screen: the phone helpers (taps, typing, scrolling, toasts) come from MethodHandlesMobile. */
public abstract class BaseScreen extends MethodHandlesMobile {

    private final AndroidDriver phone;

    protected BaseScreen(AndroidDriver androidDriver) {
        super(androidDriver);
        this.phone = androidDriver;
    }

    // TICKET-983: waited reads for assertions - poll until the expected state, return what was seen (utils.WaitedReads).
    protected int countBecomes(By locator, int expected, int seconds) { return WaitedReads.countBecomes(phone, locator, expected, seconds); }
    protected int settledCount(By locator, int seconds) { return WaitedReads.settledCount(phone, locator, seconds); }
    protected boolean isShownWithin(By locator, int seconds) { return WaitedReads.isShownWithin(phone, locator, seconds); }
    protected boolean isGoneWithin(By locator, int seconds) { return WaitedReads.isGoneWithin(phone, locator, seconds); }
    protected boolean isEnabledWithin(By locator, int seconds) { return WaitedReads.isEnabledWithin(phone, locator, seconds); }
    protected boolean isDisabledWithin(By locator, int seconds) { return WaitedReads.isDisabledWithin(phone, locator, seconds); }
    protected String textBecomes(By locator, String expected, int seconds) { return WaitedReads.textBecomes(phone, locator, expected, seconds); }
    protected String messageOf(By locator, int seconds) { return WaitedReads.messageOf(phone, locator, seconds); }
}
