package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.WebDriverWait;
import utils.AnyOf;
import utils.MethodHandlesWeb;

import java.time.Duration;

/**
 * The portal's sign-in (account code → Next → user name + password → verification code) and the signed-in header.
 * Works in both designs (the old form, and the new one - browser storage "old" = "new" - whose code is a dialog): every
 * field is found by stable attributes of either design (AI runs 68-70: #userName, #password, code-input tel boxes;
 * the old form: placeholders). The portal runs in Arabic; English labels are matched too.
 */
public class LoginPage extends MethodHandlesWeb {

    private final By accountCode = By.xpath("//input[@id='code' or @name='code' or @formcontrolname='code' or @formcontrolname='accountCode'"
            + " or @placeholder='رمز الحساب' or @aria-label='رمز الحساب' or contains(@placeholder,'ccount code') or contains(@placeholder,'Account')]");
    private final By nextButton = By.xpath("//button[contains(normalize-space(),'التالي') or contains(normalize-space(),'Next')]");
    private final By userName = By.xpath("//input[@id='userName' or @name='userName' or @formcontrolname='userName'"
            + " or @placeholder='الهاتف أو البريد الإلكتروني' or @aria-label='اسم المستخدم']");
    private final By password = By.xpath("//input[@id='password' or @name='password' or @formcontrolname='password' or @type='password']");
    private final By loginButton = By.xpath("//button[contains(normalize-space(),'تسجيل الدخول') or contains(normalize-space(),'Log in') or contains(normalize-space(),'Login') or contains(normalize-space(),'Sign in')]");
    private static final String CODE_BOXES = "//code-input//input | //input[contains(@class,'inputOTP')] | //*[@role='dialog' or contains(@class,'modal')]//input[@type='tel' or @inputmode='numeric']";
    private final By codeBoxes = By.xpath(CODE_BOXES);
    private final By sendCodeButton = By.xpath("//*[@role='dialog' or contains(@class,'modal') or contains(@class,'OTP')]//button[contains(normalize-space(),'إرسال') or contains(normalize-space(),'تأكيد') or contains(normalize-space(),'Send') or contains(normalize-space(),'Confirm') or contains(normalize-space(),'Verify')]");
    private final By userMenu = By.xpath("//header//a[contains(@class,'dropdown-toggle')] | //header//button[contains(@class,'dropdown-toggle')]");
    private final By logoutButton = By.xpath("//*[contains(@class,'dropdown-item')][contains(normalize-space(),'تسجيل الخروج') or contains(normalize-space(),'Log out') or contains(normalize-space(),'Logout') or contains(normalize-space(),'Sign out')]");

    public LoginPage(WebDriver driver) {
        super(driver);
    }

    /** Types the account code and presses Next; a portal that remembers the account shows the user name at once (skipped). */
    public void enterAccountCode(String code) {
        isShownWithin(AnyOf.anyOf(accountCode, userName), 20);
        if (!isShownWithin(accountCode, 1)) return;
        clear(accountCode, 10);
        sendKeys(accountCode, 10, code);
        click(nextButton, 10);
    }

    public void enterUserNameAndPassword(String user, String pass) {
        explicitWait(userName, 20);
        clear(userName, 10);
        sendKeys(userName, 10, user);
        clear(password, 10);
        sendKeys(password, 10, pass);
    }

    /** Presses Log in when the code boxes are not there yet, types one digit per box, then confirms when the dialog asks. */
    public void enterVerificationCode(String code) {
        if (!isShownWithin(codeBoxes, 3)) {
            click(loginButton, 10);
        }
        explicitWait(codeBoxes, 20);
        int boxes = settledCount(codeBoxes, 5);
        if (boxes == 1) {
            clear(codeBoxes, 10);
            sendKeys(codeBoxes, 10, code);
        } else {
            for (int i = 0; i < boxes && i < code.length(); i++) {
                By box = By.xpath("(" + CODE_BOXES + ")[" + (i + 1) + "]");
                click(box, 10);
                clear(box, 10);
                sendKeys(box, 10, String.valueOf(code.charAt(i)));
            }
        }
        if (isEnabledWithin(sendCodeButton, 3)) {
            click(sendCodeButton, 10);
        }
    }

    public boolean waitForPage(String urlPart) {
        try {
            new WebDriverWait(driver, Duration.ofSeconds(30)).until(d -> d.getCurrentUrl().contains(urlPart));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean signedInMenuShown() {
        return isShownWithin(userMenu, 20);
    }

    public String signedInUserText() {
        return getText(userMenu, 10);
    }

    public void signOut() {
        click(userMenu, 15);
        click(logoutButton, 15);
    }

    public boolean loginPageShown() {
        return isShownWithin(AnyOf.anyOf(accountCode, userName), 20);
    }
}
