package utils;

import com.aventstack.extentreports.ExtentReports;
import com.aventstack.extentreports.Status;
import com.aventstack.extentreports.reporter.ExtentSparkReporter;
import com.aventstack.extentreports.reporter.configuration.Theme;
import org.apache.commons.io.FileUtils;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.testng.ISuite;
import org.testng.ITestResult;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Method;
import java.util.List;
import java.nio.file.Paths;

import static utils.MethodHandlesWeb.extent;
import static utils.MethodHandlesWeb.test;

public class UtilsTests extends ReportEntrySteps { // Omar 2026-10-25: loginByApi + loginProgrammatically() live in SignInSteps

    // the driver: SignInSteps.driver

    /** Where the running suite's html, screenshots and videos go: report/<suite xml name>. */
    private static String reportDir = "report";
    private static String reportName = "report";

    public UtilsTests(WebDriver driver) {
        this.driver = driver;
    }

    /**
     * The last screen, or - when the browser / phone no longer answers (Chrome "Timed out receiving message
     * from renderer" on a Jenkins run) - a line in the entry saying why it is missing,
     * instead of an entry with no attachments and no explanation. The recording is attached either way.
     */
    public void saveLastScreenOrExplain(Method method) {
        try {
            takeScreenShot(method);
        } catch (Exception e) {
            String reason = String.valueOf(e.getMessage()).split("\n")[0];
            System.out.println("Could not save the last screen: " + reason);
            if (test != null) {
                test.warning("No last screen: the browser / phone did not answer (" + reason
                        + "). The recording shows the steps up to that point.");
            }
        }
    }

    public void takeScreenShot(Method method) throws IOException {
        File file = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
        FileUtils.copyFile(file, new File(reportDir + "/" + testCaseFileName + ".png"));

    }

    /**
     * One folder per env and suite file, from the suite's server parameter:
     * Test  + webLogin.xml -> report/testEnv/webLogin/webLogin.html
     * Stage + webLogin.xml -> report/stageEnv/webLogin/webLogin.html
     * with that suite's .png and .gif beside it, so the relative links inside the html keep working.
     * A class run straight from the IDE has no xml file, so it falls back to the suite name.
     */
    public static void setReportFolder(ISuite suite, String server) {
        reportEnv = utils.TestData.setEnv(server);
        String envFolder = utils.TestData.reportFolder();
        String fileName = suite.getXmlSuite().getFileName();
        String name = fileName != null
                ? Paths.get(fileName).getFileName().toString().replaceFirst("(?i)\\.xml$", "")
                : suite.getName();
        reportName = name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        suiteTests = suite.getAllMethods().size();
        reportDir = "report/" + envFolder + "/" + reportName;
        new File(reportDir).mkdirs();
    }

    public static String getReportDir() {
        return reportDir;
    }

    /** The html the current ExtentReports writes to. */
    private static String reportFile;
    /** How many test methods the running suite has - for the live view's progress. */
    private static int suiteTests;

    /**
     * A hybrid suite runs both the web and the mobile @BeforeSuite: the second call finds the report
     * already made for this suite's file and keeps it, so web and phone tests land in one report.
     */
    public void createReport() {
        String file = reportDir + "/" + reportName + ".html";
        if (extent != null && file.equals(reportFile)) {
            return;
        }
        reportFile = file;
        testCaseNumber = 0;
        extent = new ExtentReports();
        ExtentSparkReporter spark = new ExtentSparkReporter(file);
        spark.config().setDocumentTitle("My Report");
        spark.config().setTheme(Theme.DARK);
        // links to real pages (the email's "open full size", links in logged steps) open in a new tab, so the
        // report - on its own or inside Jenkins - stays where it was; Extent's own # links and downloads don't
        spark.config().setJs("document.addEventListener('click',function(e){"
                + "var a=e.target.closest&&e.target.closest('a[href]');if(!a||a.hasAttribute('download'))return;"
                + "var h=a.getAttribute('href');if(!h||h.charAt(0)==='#'||h.indexOf('javascript:')===0)return;"
                + "a.target='_blank';a.rel='noopener';},true);");
        extent.attachReporter(spark);
        extent.setSystemInfo("Env", reportEnv);
        LiveFeed.run(reportName, reportEnv, suiteTests);

    }

    /** The attachments / player script, for other rows that add a card to the Attachments tab (EmailReport). */
    static String attachmentsScript() {
        return PLAYER_SCRIPT;
    }

    private static final String PLAYER_SCRIPT = ReportPlayerScript.TEXT;

    /**
     * The Timeline tab of the entry ({@link TestTimeline}): steps with their locators, the browser's API calls
     * and page loads, checks, console errors and the failure, in order, next to the recording's frames.
     * Logged before the attachments, so its tab comes right after Steps.
     */
    public void addTimeline(ITestResult result) {
        if (test == null) {
            return;
        }
        // the live page's way back to this test's steps once the run is over (from the published report)
        LiveFeed.recording(BrowserGifRecorder.framesFolderName(testCaseFileName) + "/", BrowserGifRecorder.getLastFrameSteps());
        try {
            String html = TestTimeline.html(BrowserGifRecorder.framesFolderName(testCaseFileName) + "/",
                    BrowserGifRecorder.getLastFrameSteps(), BrowserGifRecorder.getLastFrameTimes(), result);
            if (html != null) {
                test.log(Status.INFO, html + PLAYER_SCRIPT);
            }
        } catch (Exception e) {
            // the Timeline is an extra - the attachments and the result must still go in
            System.out.println("Could not write the Timeline: " + e);
        }
    }

    /**
     * The last screen and the browser recording, side by side. The recording is a small player over
     * the frames in {@code <method>_frames/} - play / pause, one frame back / forward, and a slider to
     * scrub - plus a GIF download. Clicking the recording (or the full screen button) opens the same
     * player full screen, and clicking the screenshot opens it full size in the same way (no new tab);
     * Esc, the close button or a click beside it closes either. The row shows no Info badge or
     * timestamp - the script hides those cells and lets the pictures use the full width. Keys while the pointer
     * is over a player: space = play / pause, left / right arrows = one frame back / forward.
     */
    public void addAttachment(Method method){
        addAttachment(method, false);
    }

    /** Same, for a phone test: {@code portrait} keeps the tall screenshots and recording to a readable height. */
    public void addAttachment(Method method, boolean portrait){
        if (test == null) {
            return;
        }
        String name = testCaseFileName;
        String png = name + ".png";
        boolean hasPng = new File(reportDir, png).isFile();   // missing when the browser hung (saveLastScreenOrExplain)
        List<Integer> durations = BrowserGifRecorder.getLastFrameDurations();
        if (!hasPng && durations.isEmpty()) {
            return;   // nothing to show
        }

        String image = "width:100%;display:block;border:1px solid rgba(128,128,128,.3);border-radius:6px";

        StringBuilder html = new StringBuilder()
                .append(portrait ? "<div class='aqp-media aqp-portrait'>" : "<div class='aqp-media'>");
        if (hasPng) {
            html.append("<figure class='aqp-card'>")
                    .append("<div class='aqp-card-h'><span class='aqp-dot'></span>Last screen<small>click to enlarge</small></div>")
                    .append("<img class='aqp-png' title='Open full screen' src='").append(png).append("' style='")
                    .append(image).append(";cursor:zoom-in'>")
                    .append("</figure>");
        }

        if (!durations.isEmpty()) {
            recordingCard(html, name, durations, image);
        }

        html.append("</div>").append(PLAYER_SCRIPT);
        test.log(Status.INFO, html.toString());
    }

    /** The player card of the recording, over the frames in {@code <method>_frames/}. */
    private static void recordingCard(StringBuilder html, String name, List<Integer> durations, String image) {
        String frames = BrowserGifRecorder.framesFolderName(name) + "/";
        String durationList = durations.toString().replaceAll("[\\[\\] ]", "");
        String button = "background:#374151;color:#fff;border:0;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:13px";
        double seconds = durations.stream().mapToInt(Integer::intValue).sum() / 1000.0;

        html.append("<figure class='aqp aqp-card' tabindex='0' data-base='").append(frames)
                .append("' data-d='").append(durationList).append("' data-i='0' data-on='1' style='outline:none'>")
                .append("<div class='aqp-card-h'><span class='aqp-dot rec'></span>Recording<small>")
                .append(durations.size()).append(" frames &middot; ").append(String.format(java.util.Locale.ROOT, "%.1f", seconds))
                .append(" s</small></div>")
                .append("<img class='aqp-i' title='Open full screen' src='").append(frames).append("000.jpg' style='")
                .append(image).append(";cursor:zoom-in'>")
                .append("<div style='display:flex;align-items:center;gap:6px;margin-top:6px'>")
                .append("<button type='button' data-act='back' title='One frame back' style='").append(button).append("'>&#9664;&#9664;</button>")
                .append("<button type='button' data-act='play' title='Play / pause' style='").append(button).append(";min-width:40px'>&#10074;&#10074;</button>")
                .append("<button type='button' data-act='fwd' title='One frame forward' style='").append(button).append("'>&#9654;&#9654;</button>")
                .append("<input type='range' class='aqp-r' min='0' max='").append(durations.size() - 1)
                .append("' value='0' style='flex:1;min-width:60px'>")
                .append("<span class='aqp-c' style='font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums'>1 / ")
                .append(durations.size()).append("</span>")
                .append("<button type='button' data-act='full' title='Full screen' style='").append(button).append("'>&#10530;</button>")
                .append("<a href='").append(name).append(".gif' download style='font-size:12px;white-space:nowrap'>Download GIF</a>")
                .append("</div></figure>");
    }

    /**
     * A screenshot taken mid-test (e.g. the report once its figures are read), saved beside the report as
     * {@code <n>_<method>_<title>.png} and added as a card to the entry's Attachments tab, next to the
     * last screen and the recording. Click it to open it full size, like the last screen.
     */
    public void attachScreenshot(String title) {
        if (test == null || driver == null) {
            return;
        }
        String png = testCaseFileName + "_" + title.replaceAll("[^A-Za-z0-9]+", "_") + ".png";
        try {
            File file = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
            FileUtils.copyFile(file, new File(reportDir + "/" + png));
        } catch (Exception e) {
            System.out.println("Could not take the " + title + " screenshot: " + e.getMessage());
            return;
        }
        test.log(Status.INFO, "<div class='aqp-media'><figure class='aqp-card'>"
                + "<div class='aqp-card-h'><span class='aqp-dot'></span>" + title + "<small>click to enlarge</small></div>"
                + "<img class='aqp-png' title='Open full screen' src='" + png + "' style='width:100%;display:block;"
                + "border:1px solid rgba(128,128,128,.3);border-radius:6px;cursor:zoom-in'>"
                + "</figure></div>" + PLAYER_SCRIPT);
    }

    public void flushReport(){
        BrowserGifRecorder.awaitGifs(); // recordings' GIFs are built in the background after each test
        extent.flush();
    }

}
