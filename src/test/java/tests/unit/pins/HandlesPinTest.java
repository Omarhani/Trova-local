package tests.unit.pins;

import com.aventstack.extentreports.ExtentReports;
import com.aventstack.extentreports.ExtentTest;
import io.appium.java_client.android.AndroidDriver;
import net.bytebuddy.ByteBuddy;
import net.bytebuddy.dynamic.scaffold.subclass.ConstructorStrategy;
import net.bytebuddy.implementation.InvocationHandlerAdapter;
import net.bytebuddy.matcher.ElementMatchers;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import utils.BrowserGifRecorder;
import utils.MethodHandlesMobile;
import utils.MethodHandlesWeb;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Pins the wait helpers as a suite and a page object see them, on a stand-in browser and phone: what a page reaches by
 * name, what every step does, its number and label, the page method it is logged for, the recording's frames, the
 * assertions, and the look-ups other helpers do by class name.
 * Run: mvn -o test -Dtest=HandlesPinTest. Save anew (only on purpose): add -DpinsWrite=true.
 */
public class HandlesPinTest {

    private final By l = By.xpath("//a");
    private final By other = By.id("b");
    private PinWeb fake;
    private ExtentTest report;
    private List<String> stepLines;

    private static Field webField(String name) throws Exception {
        Field f = MethodHandlesWeb.class.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    @BeforeMethod
    public void freshStart() throws Exception {
        fake = new PinWeb();
        fake.vanishing.add("By.id: toast-container");
        report = new ExtentReports().createTest("pin");
        webField("test").set(null, report);
        stepLines = fake.calls;
        MethodHandlesWeb.resetStepNumber();
        MethodHandlesWeb.setBeforeStep(() -> stepLines.add("before step " + MethodHandlesWeb.currentStepNumber()));
        MethodHandlesWeb.setOnStep(() -> stepLines.add("on step " + MethodHandlesWeb.currentStepNumber()));
        MethodHandlesWeb.setStepListener(s -> stepLines.add("step " + s.number() + " | " + s.action() + " | " + s.locator() + " | " + s.element()
                + " | " + s.caller() + " | " + s.passed() + " | " + s.detail()));
        MethodHandlesMobile.resetStepNumber();
        MethodHandlesMobile.setOnStep((rect, number, action) -> stepLines.add("step " + number + " | " + action + " | " + rect.getX()));
    }

    @AfterMethod(alwaysRun = true)
    public void cleanUp() throws Exception {
        MethodHandlesWeb.setBeforeStep(null);
        MethodHandlesWeb.setOnStep(null);
        MethodHandlesWeb.setStepListener(null);
        MethodHandlesWeb.resetStepNumber();
        MethodHandlesMobile.setOnStep(null);
        MethodHandlesMobile.resetStepNumber();
        webField("test").set(null, null);
    }

    private List<String> reportLines() {
        return report.getModel().getLogs().stream().map(log -> "report " + log.getStatus() + " " + log.getDetails()).collect(Collectors.toList());
    }

    private WebPinPage page() {
        WebDriver driver = fake.browser();
        return new WebPinPage(driver, fake::nextStep);
    }

    private AndroidDriver phone() throws Exception {
        Class<? extends AndroidDriver> type = new ByteBuddy().subclass(AndroidDriver.class, ConstructorStrategy.Default.NO_CONSTRUCTORS)
                .method(ElementMatchers.isPublic().and(ElementMatchers.not(ElementMatchers.isDeclaredBy(Object.class))))
                .intercept(InvocationHandlerAdapter.of((p, m, a) -> fake.driverCall(p, m, a == null ? new Object[0] : a)))
                .make().load(getClass().getClassLoader()).getLoaded();
        Field unsafe = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
        unsafe.setAccessible(true);
        return (AndroidDriver) ((sun.misc.Unsafe) unsafe.get(null)).allocateInstance(type);
    }

    private void matchesWithReport(String name, List<String> said) throws Exception {
        List<String> lines = new ArrayList<>(said);
        lines.add("-- calls");
        lines.addAll(fake.calls);
        lines.add("-- report");
        lines.addAll(reportLines());
        PinGolden.matches(name, lines);
    }

    @Test
    public void whatAPageCanReachByNameStays() throws Exception {
        PinGolden.matches("web-api.txt", PinGolden.reachable(MethodHandlesWeb.class));
        PinGolden.matches("mobile-api.txt", PinGolden.reachable(MethodHandlesMobile.class));
    }

    @Test
    public void everyWebStepDoesWhatItDid() throws Exception {
        WebPinPage page = page();
        page.everyAct(l, other);
        matchesWithReport("web-steps.txt", page.said);
    }

    @Test
    public void aRedrawnElementIsFoundAgainAndTypingIsCheckedOnce() throws Exception {
        WebPinPage page = page();
        fake.staleOnce = true;
        page.staleClick(l);
        fake.valueEchoes = true;
        page.typedRight(l);
        matchesWithReport("web-retries.txt", page.said);
    }

    @Test
    public void everyPhoneStepDoesWhatItDid() throws Exception {
        MobilePinScreen screen = new MobilePinScreen(phone());
        screen.everyAct(By.id("a"));
        matchesWithReport("mobile-steps.txt", screen.said);
    }

    @Test
    public void aTapThatChangesNothingIsTappedOnceMore() throws Exception {
        fake.tapChangesScreen = false;
        MobilePinScreen screen = new MobilePinScreen(phone());
        screen.clickThatChangesNothing(By.id("a"));
        matchesWithReport("mobile-no-change.txt", screen.said);
    }

    /** setStep reads four frames up, the box two: the page method is logged and the helper's name gives the label */
    @Test
    public void aWebStepIsLoggedForItsPageMethodAndLabelledByItsHelper() {
        WebPinPage page = page();
        page.saveOrder(l);
        page.typeName(l);
        page.readTotal(l);
        page.checkShown(l);
        page.markItCustom(l);
        List<String> logged = report.getModel().getLogs().stream().map(log -> log.getDetails()).collect(Collectors.toList());
        Assert.assertEquals(logged, List.of("saveOrder", "typeName", "readTotal", "checkShown"));
        List<String> steps = fake.calls.stream().filter(c -> c.startsWith("step ")).map(c -> c.split(" \\| ")[1] + "/" + c.split(" \\| ")[4]).collect(Collectors.toList());
        Assert.assertEquals(steps, List.of("click/SignedOutStep.act", "type/WebPinPage.typeName", "check/WebPinPage.readTotal", "check/WebPinPage.checkShown",
                "custom/WebPinPage.markItCustom"));
    }

    @Test
    public void aPhoneStepIsLoggedForItsScreenMethodAndLabelledByItsHelper() throws Exception {
        MobilePinScreen screen = new MobilePinScreen(phone());
        screen.tapItOnce(By.id("a"));
        screen.saveOrder(By.id("a"));
        screen.typeName(By.id("a"));
        screen.readTotal(By.id("a"));
        List<String> logged = report.getModel().getLogs().stream().map(log -> log.getDetails()).collect(Collectors.toList());
        Assert.assertEquals(logged, List.of("tapItOnce", "saveOrder", "typeName", "readTotal"));
        List<String> labels = fake.calls.stream().filter(c -> c.startsWith("step ")).map(c -> c.split(" \\| ")[1]).collect(Collectors.toList());
        Assert.assertEquals(labels, List.of("click", "click", "type", "check"));
    }

    @Test
    public void everyAssertionIsReportedAndNamedAfterWhereItWasMade() throws Exception {
        List<String> said = new ArrayList<>();
        WebPinPage page = page();
        tryIt(said, () -> MethodHandlesWeb.myAssertEquals(1, 1));
        tryIt(said, () -> MethodHandlesWeb.myAssertEquals("Named", "a", "b"));
        tryIt(said, () -> MethodHandlesWeb.myAssertContains("Part", "abc", "b"));
        tryIt(said, () -> MethodHandlesWeb.myAssertTrue(true));
        tryIt(said, () -> MethodHandlesWeb.myAssertTrue("Named true", false));
        tryIt(said, () -> MethodHandlesWeb.myAssertFalse(false));
        tryIt(said, () -> MethodHandlesWeb.myAssertFalse("Named false", true));
        tryIt(said, () -> page.checkTotal(5, 5));
        tryIt(said, () -> page.checkTotal(5, 6));
        tryIt(said, () -> MethodHandlesWeb.softly("Group", () -> {
            MethodHandlesWeb.myAssertEquals("In group", 1, 2);
            MethodHandlesWeb.myAssertTrue("Also in group", true);
        }));
        matchesWithReport("assertions.txt", said);
    }

    private static void tryIt(List<String> said, Runnable assertion) {
        try {
            assertion.run();
            said.add("passed");
        } catch (AssertionError e) {
            said.add("failed: " + e.getMessage());
        }
    }

    /** every step has its picture, in order, whatever the recorder's own timing: what the report's player needs */
    @Test
    public void aRecordingHasAFrameForEveryStep() throws Exception {
        Field dir = Class.forName("utils.UtilsTests").getDeclaredField("reportDir");
        dir.setAccessible(true);
        Object before = dir.get(null);
        java.nio.file.Path folder = Files.createTempDirectory("pins");
        dir.set(null, folder.toString());
        try {
            WebDriver driver = fake.browser();
            BrowserGifRecorder.startRecord(driver, "pinRecording");
            WebPinPage page = new WebPinPage(driver, fake::nextStep);
            page.saveOrder(l);
            page.typeName(l);
            page.readTotal(l);
            BrowserGifRecorder.stopRecord();
            List<Integer> steps = BrowserGifRecorder.getLastFrameSteps();
            Assert.assertEquals(steps.get(steps.size() - 1), Integer.valueOf(3), steps.toString());
            for (int n = 1; n <= 3; n++) Assert.assertTrue(steps.contains(n), "frame of step " + n + ": " + steps);
            for (int i = 1; i < steps.size(); i++) Assert.assertTrue(steps.get(i) >= steps.get(i - 1), steps.toString());
            Assert.assertEquals(BrowserGifRecorder.getLastFrameDurations().size(), steps.size());
            Assert.assertTrue(Files.exists(folder.resolve("pinRecording_frames/000.jpg")));
            MethodHandlesWeb.resetStepNumber();
            page.saveOrder(l);
            Assert.assertEquals(MethodHandlesWeb.currentStepNumber(), 1, "a stopped recording leaves the steps alone");
            BrowserGifRecorder.awaitGifs();
        } finally {
            dir.set(null, before);
        }
    }

    /** Other helpers find these by class name and by reflection: they must stay declared on the class itself. */
    @Test
    public void theLookUpsByClassNameStillFindThem() throws Exception {
        Assert.assertEquals(webField("test").getDeclaringClass(), MethodHandlesWeb.class);
        Assert.assertEquals(webField("extent").getDeclaringClass(), MethodHandlesWeb.class);
        Assert.assertEquals(MethodHandlesWeb.class.getMethod("setURL", String.class).getDeclaringClass(), MethodHandlesWeb.class);
        Assert.assertEquals(MethodHandlesWeb.class.getMethod("getURL").getDeclaringClass(), MethodHandlesWeb.class);
        for (Method m : MethodHandlesWeb.class.getMethods()) {
            if (m.getName().startsWith("myAssert") || m.getName().equals("softly")) {
                Assert.assertEquals(m.getDeclaringClass(), MethodHandlesWeb.class, m.getName());
            }
        }
        Assert.assertEquals(MethodHandlesWeb.Step.class.getEnclosingClass(), MethodHandlesWeb.class);
        Assert.assertEquals(MethodHandlesMobile.StepListener.class.getEnclosingClass(), MethodHandlesMobile.class);
    }

    /** AiHelpAsk writes through the reflected report field and takes the step number from the class. */
    @Test
    public void aiHelpFindsTheReportAndTheStepByName() throws Exception {
        WebPinPage page = page();
        page.saveOrder(l);
        Method mark = Class.forName("utils.AiHelpAsk").getDeclaredMethod("mark", String.class, String.class);
        mark.setAccessible(true);
        mark.invoke(null, "Page.step", "pressed Save");
        List<String> logged = report.getModel().getLogs().stream().map(log -> log.getDetails()).collect(Collectors.toList());
        Assert.assertEquals(logged, List.of("saveOrder", "AI helped: pressed Save"));
        Method where = Class.forName("utils.AiHelpAsk").getDeclaredMethod("where");
        where.setAccessible(true);
        String[] found = (String[]) where.invoke(null);
        Assert.assertTrue(found[0].startsWith("HandlesPinTest."), found[0]);
    }

    /** No step helper may gain a frame: a bridge in a public class would (javac adds one for a public method of a hidden parent). */
    @Test
    public void noHelperHasABridge() {
        for (Class<?> c = MethodHandlesWeb.class; c != Object.class; c = c.getSuperclass()) noBridges(c);
        for (Class<?> c = MethodHandlesMobile.class; c != Object.class; c = c.getSuperclass()) noBridges(c);
    }

    private static void noBridges(Class<?> c) {
        for (Method m : c.getDeclaredMethods()) Assert.assertFalse(m.isBridge(), c.getName() + "." + m.getName());
    }
}
