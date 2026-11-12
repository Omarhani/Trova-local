package pages.base;

import org.openqa.selenium.WebDriver;
import utils.MethodHandlesWeb;

/** Parent of every web page object: the web helpers (waits, clicks, typing, step log) come from MethodHandlesWeb. */
public abstract class BasePage extends MethodHandlesWeb {

    protected BasePage(WebDriver driver) {
        super(driver);
    }
}
