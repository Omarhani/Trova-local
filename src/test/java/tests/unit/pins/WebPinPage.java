package tests.unit.pins;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import utils.MethodHandlesWeb;

import java.util.ArrayList;
import java.util.List;

/** A page object of a suite, in its own package: reaches the helpers only as any page does. */
class WebPinPage extends MethodHandlesWeb {

    interface Run {
        void go() throws Exception;
    }

    final List<String> said = new ArrayList<>();
    private final Runnable beforeEach;

    WebPinPage(WebDriver driver, Runnable beforeEach) {
        super(driver);
        this.beforeEach = beforeEach;
    }

    private void step(String name, Run run) {
        beforeEach.run();
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

    void everyAct(By l, By other) {
        step("click", () -> click(l, 1));
        step("submit", () -> submit(l, 1));
        step("clickWithActions", () -> clickWithActions(l, 1));
        step("smartClick", () -> smartClick(l, 1));
        step("doubleClick", () -> doubleClick(l, 1));
        step("contextClick", () -> contextClick(l, 1));
        step("clickAndHold", () -> clickAndHold(l, 1));
        step("escapeButton", this::escapeButton);
        step("sendKeysWithEnter", () -> sendKeysWithEnter(l, "t"));
        step("sendKeysWithEnterAndEscape", () -> sendKeysWithEnterAndEscape(l, "t"));
        step("moveToElement", () -> moveToElement(l, 1));
        step("dragAndDrop", () -> dragAndDrop(l, other, 1));
        step("release", () -> release(l, 1));
        step("releaseNow", () -> release(1));
        step("scrollToElementInModal", () -> scrollToElementInModal(l));
        step("pressKey", () -> pressKey(l, 1, "k"));
        step("clear", () -> clear(l, 1));
        step("sendKeys", () -> sendKeys(l, 1, "typed"));
        step("sendKeysWithDelay", () -> sendKeysWithDelay(l, "ab"));
        step("selectByValue", () -> selectByValue(l, "v", 1));
        step("selectByIndex", () -> selectByIndex(l, 0, 1));
        step("selectByVisibleText", () -> selectByVisibleText(l, "v", 1));
        step("insertTimeMovement", () -> insertTimeMovement("10:00", l));
        step("acceptAlert", () -> acceptAlert(1));
        step("dismissAlert", () -> dismissAlert(1));
        step("sendKeysAlert", () -> sendKeysAlert("a", 1));
        step("highlightBy", () -> highlight(l, "custom"));
        step("highlightElement", () -> highlight(webElement(l), "custom2"));
        step("openPage", () -> openPage("http://x", l));
        step("clickAccept", this::clickAccept);
        step("clickReject", this::clickReject);
        step("hideElement", () -> hideElement(l));
        step("scrollIntoView", () -> scrollIntoView(l));
        step("scrollIntoElement", () -> scrollIntoElement(webElement(l)));
        step("invisibilityOf", () -> invisibilityOf(By.id("gone"), 1));
        step("setStep", this::setStep);
        step("explicitWait", () -> explicitWait(l, 1));
        step("waitForToasterToAppearAndDisappear", this::waitForToasterToAppearAndDisappear);
        step("waitForToaster", () -> waitForToaster(1, 1));
        everyRead(l);
    }

    private void everyRead(By l) {
        step("getText", () -> out(getText(l, 1)));
        step("getTextUsingHorizontalScroll", () -> out(getTextUsingHorizontalScroll(l)));
        step("getTextFromDOM", () -> out(getTextFromDOM(l, 1)));
        step("getTextViaJS", () -> out(getTextViaJS(l, 1)));
        step("isSelected", () -> out(isSelected(l, 1)));
        step("isDisplayed", () -> out(isDisplayed(l, 1)));
        step("isEnabled", () -> out(isEnabled(l, 1)));
        step("getToasterContent", () -> out(getToasterContent()));
        step("getTextAlert", () -> out(getTextAlert(1)));
        step("webElementFound", () -> out(webElement(l) != null));
        step("webElementsFound", () -> out(webElements(l).size()));
    }

    /** a click whose element is redrawn under it: found again, boxed again */
    void staleClick(By l) {
        step("clickAfterRedraw", () -> click(l, 1));
    }

    /** typing that reads back as typed: no second try */
    void typedRight(By l) {
        step("sendKeysReadBack", () -> sendKeys(l, 1, "typed"));
    }

    void saveOrder(By l) {
        click(l, 1);
    }

    void typeName(By l) {
        sendKeys(l, 1, "typed");
    }

    String readTotal(By l) {
        return getText(l, 1);
    }

    boolean checkShown(By l) {
        return isDisplayed(l, 1);
    }

    void markItCustom(By l) {
        highlight(l, "custom");
    }

    void checkTotal(Object actual, Object expected) {
        myAssertEquals("Order total", actual, expected);
    }
}
