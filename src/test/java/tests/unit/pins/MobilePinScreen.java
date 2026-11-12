package tests.unit.pins;

import io.appium.java_client.android.AndroidDriver;
import org.openqa.selenium.By;
import org.openqa.selenium.Rectangle;
import utils.MethodHandlesMobile;

import java.util.ArrayList;
import java.util.List;

/** A screen object of a suite, in its own package. */
class MobilePinScreen extends MethodHandlesMobile {

    final List<String> said = new ArrayList<>();

    MobilePinScreen(AndroidDriver driver) {
        super(driver);
    }

    private void step(String name, WebPinPage.Run run) {
        said.add("== " + name);
        try {
            run.go();
        } catch (Exception e) {
            said.add("threw " + e.getClass().getSimpleName());
        }
    }

    private void out(Object value) {
        said.add("-> " + value);
    }

    void everyAct(By l) {
        step("click", () -> click(l, 1));
        step("clickOnce", () -> clickOnce(l, 1));
        step("tapField", () -> tapField(l, 1));
        step("smartClick", () -> smartClick(l, 1));
        step("sendKeys", () -> sendKeys(l, "typed", 1));
        step("isDisplayed", () -> out(isDisplayed(l, 1)));
        step("isNotDisplayed", () -> out(isDisplayed(By.id("gone"), 0)));
        step("isPresent", () -> out(isPresent(l, 1)));
        step("isNotPresent", () -> out(isPresent(By.id("gone"), 0)));
        step("tapPoint", () -> tapPoint(1, 2));
        step("hideKeyboardIfShown", this::hideKeyboardIfShown);
        step("restartApp", this::restartApp);
        step("scrollIntoViewWithin", () -> scrollIntoViewWithin(l, l, 1));
        step("scrollIntoViewWithinGone", () -> scrollIntoViewWithin(l, By.id("gone"), 1));
        step("swipeWithin", () -> swipeWithin(new Rectangle(1, 2, 30, 40), true));
        step("scrollAndClick", () -> scrollAndClick(l));
        step("scrollAndClickGone", () -> scrollAndClick(By.id("gone")));
        step("getToasterContent", () -> out(getToasterContent(l)));
        step("waitForToasterToAppear", this::waitForToasterToAppear);
        step("clickFlutterLeftAsset", () -> clickFlutterLeftAsset(l));
        step("getFlutterText", () -> out(getFlutterText(l)));
        step("getToasterMessage", () -> out(getToasterMessage()));
        step("getToasterMessageOnce", () -> out(getToasterMessageOnce()));
        step("toasterMessageIsDisplayed", () -> out(toasterMessageIsDisplayed()));
        step("waitForScreenToSettle", () -> waitForScreenToSettle(1, 1));
        step("explicitWait", () -> explicitWait(l, 1, 10));
        step("webElement", () -> out(webElement(l) != null));
        step("setStep", this::setStep);
    }

    /** a tap that changes nothing on screen: the click taps once more */
    void clickThatChangesNothing(By l) {
        step("clickNoChange", () -> click(l, 1));
    }

    void saveOrder(By l) {
        clickOnce(l, 1);
    }

    void typeName(By l) {
        sendKeys(l, "typed", 1);
    }

    String readTotal(By l) {
        return getFlutterText(l);
    }

    void tapItOnce(By l) {
        click(l, 1);
    }
}
