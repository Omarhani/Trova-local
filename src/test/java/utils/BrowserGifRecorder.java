package utils;

import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chromium.ChromiumDriver;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.LockSupport;

/**
 * Records the browser - not the machine's screen - for the report.
 *
 * <p>Output per test method, next to the report:
 * <ul>
 *   <li>{@code <methodName>_frames/000.jpg, 001.jpg ...} - the frames the report's player steps
 *       through (pause / back / forward), durations in {@link #getLastFrameDurations()};</li>
 *   <li>{@code <methodName>.gif} - the same recording as one file, for download.</li>
 * </ul>
 *
 * <p>Built to cost the test as little as possible:
 * <ul>
 *   <li>The only work done while the test waits is grabbing the picture, via Chrome/Edge DevTools
 *       ({@code Page.captureScreenshot} as JPEG - much cheaper than a WebDriver PNG). Anything else
 *       falls back to a normal WebDriver screenshot.</li>
 *   <li>Decoding, scaling and writing the frames happen on a separate encoder thread.</li>
 *   <li>The GIF (the slow part - colour quantising) is built after the test, in the background.
 *       {@link #awaitGifs()} waits for the last ones before the report is flushed.</li>
 *   <li>A screenshot identical to the previous one is dropped before any decoding - that frame
 *       simply lasts longer.</li>
 * </ul>
 *
 * <p>Two modes, chosen with {@code -Drecording}:
 * <ul>
 *   <li>{@code steps} (default) - one frame per highlighted step (click, type, check, select, toast: the
 *       numbered box from {@code MethodHandlesWeb}) plus the final state, each shown {@link #STEP_FRAME_MS}.
 *       Frame N is step N, so a recording is a step-by-step slideshow of ~20 frames instead of ~70.</li>
 *   <li>{@code full} - also a frame every {@link #INTERVAL_MS} in real time, as before: shows what happens
 *       between steps (loading, a message that comes and goes). For debugging a flaky test.</li>
 * </ul>
 * In both, {@link #captureNow()} grabs a frame the moment a step is highlighted, so no step is missed.
 * It works headless and on Jenkins (a Windows service has no desktop), and other windows on the
 * machine never end up in the recording.
 */
public class BrowserGifRecorder {

    /** {@code -Drecording=full}: timed frames every {@link #INTERVAL_MS} as well; anything else: step frames only. */
    private static final boolean FULL = "full".equalsIgnoreCase(System.getProperty("recording", "steps").trim());
    /** How long each step frame is shown in the player and the GIF, in steps mode. */
    private static final int STEP_FRAME_MS = 1000;

    /** Time between two timed frames. */
    private static final long INTERVAL_MS = 300;
    /** Shortest time between two frames, even when steps ask for more. */
    private static final long MIN_GAP_MS = 250;
    /** Width of the player's frames; 1920x1080 becomes 1280x720. */
    private static final int FRAME_WIDTH = 1280;
    /** How long the last frame stays on screen before the recording loops. */
    private static final int LAST_FRAME_MS = 2000;

    /** Builds GIFs after their test, one at a time, off the test thread. */
    private static final ExecutorService GIF_BUILDER = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "gif-builder");
        t.setDaemon(true);
        return t;
    });
    private static final List<Future<?>> pendingGifs = Collections.synchronizedList(new ArrayList<>());

    private static volatile BrowserGifRecorder current;
    /** Frame durations (ms) of the recording that was stopped last - one per jpg in its frames folder. */
    private static List<Integer> lastFrameDurations = Collections.emptyList();
    /** Per frame of that recording: the step whose box it shows, and when it was taken (wall clock) - for the Timeline. */
    private static List<Integer> lastFrameSteps = Collections.emptyList();
    private static List<Long> lastFrameTimes = Collections.emptyList();

    private final WebDriver driver;
    private final File gifFile;
    private final File framesDir;
    private final ExecutorService encoder = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "frame-encoder");
        t.setDaemon(true);
        return t;
    });
    private Thread timer;
    private volatile boolean running;
    private boolean useCdp;

    // grab side (guarded by this)
    private byte[] lastGrab;
    /** nanoTime of the last highlighted step, and of the start of the last screenshot. */
    private volatile long lastStepAt;
    private volatile long lastGrabStartedAt;
    // encoder side (encoder thread only)
    private final List<Integer> frameDurations = new ArrayList<>();
    private final List<Integer> frameSteps = new ArrayList<>();
    private final List<Long> frameTimes = new ArrayList<>();
    private BufferedImage pendingFrame;
    private long pendingFrameTakenAt;
    private int pendingFrameStep;

    private BrowserGifRecorder(WebDriver driver, File gifFile, File framesDir) {
        this.driver = driver;
        this.gifFile = gifFile;
        this.framesDir = framesDir;
        this.useCdp = driver instanceof ChromiumDriver;
    }

    /** The frames folder of a method's recording, relative to the report: {@code <methodName>_frames}. */
    public static String framesFolderName(String methodName) {
        return methodName + "_frames";
    }

    /** Frame durations (ms) of the last stopped recording, in the order of its jpg files. */
    public static List<Integer> getLastFrameDurations() {
        return lastFrameDurations;
    }

    /** Per frame of the last stopped recording: the number of the step whose box it shows (0 = before the first). */
    public static List<Integer> getLastFrameSteps() {
        return lastFrameSteps;
    }

    /** Per frame of the last stopped recording: when it was taken, wall clock ms. */
    public static List<Long> getLastFrameTimes() {
        return lastFrameTimes;
    }

    /** Starts recording the browser for {@code methodName}. */
    public static synchronized void startRecord(WebDriver driver, String methodName) {
        stopRecord();
        if (!(driver instanceof TakesScreenshot)) {
            return;
        }
        File folder = new File(UtilsTests.getReportDir());
        File framesDir = new File(folder, framesFolderName(methodName));
        deleteFolder(framesDir); // a re-run of the same method must not mix in the old frames
        framesDir.mkdirs();
        lastFrameDurations = Collections.emptyList();
        lastFrameSteps = Collections.emptyList();
        lastFrameTimes = Collections.emptyList();

        current = new BrowserGifRecorder(driver, new File(folder, methodName + ".gif"), framesDir);
        current.start();

        // every highlighted step (numbered box from MethodHandlesWeb) gets its own frame
        MethodHandlesWeb.resetStepNumber();
        MethodHandlesWeb.setOnStep(BrowserGifRecorder::captureNow);
        MethodHandlesWeb.setBeforeStep(BrowserGifRecorder::ensureLastStepCaptured);
    }

    /**
     * Called just before the next step removes the previous step's box: if no frame has been taken
     * since that box appeared (two steps in quick succession), take one now, so the box makes it into
     * the recording. When the steps are further apart - the usual case - this returns at once.
     */
    public static void ensureLastStepCaptured() {
        BrowserGifRecorder recorder = current;
        if (recorder != null) {
            synchronized (recorder) {
                if (recorder.lastStepAt > recorder.lastGrabStartedAt) {
                    recorder.grab();
                }
            }
        }
    }

    /**
     * Asks for a frame right now, on top of the timed ones - called the moment a step is highlighted,
     * so even a step faster than {@link #INTERVAL_MS} shows up with its number. It only wakes the
     * recorder thread; the test does not wait for the screenshot. The highlight stays on screen for
     * 1.5 s and quick steps keep their boxes side by side, so the next frame still shows every step.
     */
    public static void captureNow() {
        BrowserGifRecorder recorder = current;
        if (recorder != null && recorder.timer != null) {
            recorder.lastStepAt = System.nanoTime();
            LockSupport.unpark(recorder.timer);
        }
    }

    /**
     * Stops the running recording: finishes its frames (so the report can show them right away) and
     * queues its GIF in the background. Safe to call when nothing is recording.
     */
    public static synchronized void stopRecord() {
        MethodHandlesWeb.setOnStep(null);
        MethodHandlesWeb.setBeforeStep(null);
        BrowserGifRecorder recorder = current;
        if (recorder == null) {
            return;
        }
        current = null;
        recorder.stop();
        lastFrameDurations = new ArrayList<>(recorder.frameDurations);
        lastFrameSteps = new ArrayList<>(recorder.frameSteps);
        lastFrameTimes = new ArrayList<>(recorder.frameTimes);
        if (!lastFrameDurations.isEmpty()) {
            List<Integer> durations = lastFrameDurations;
            pendingGifs.add(GIF_BUILDER.submit(() -> RecordingGif.build(recorder.framesDir, durations, recorder.gifFile)));
        }
    }

    /**
     * Hands a finished recording made elsewhere (the phone's, {@link MobileScreenRecorder}) to the
     * report: {@link #getLastFrameDurations()} returns its durations and its GIF is queued with the
     * browser ones, so {@link #awaitGifs()} waits for it too. An empty list just clears the last one.
     */
    static synchronized void setLastRecording(File framesDir, List<Integer> durations, File gifFile) {
        lastFrameDurations = new ArrayList<>(durations);
        lastFrameSteps = Collections.emptyList();
        lastFrameTimes = Collections.emptyList();
        if (!durations.isEmpty()) {
            List<Integer> copy = lastFrameDurations;
            pendingGifs.add(GIF_BUILDER.submit(() -> RecordingGif.build(framesDir, copy, gifFile)));
        }
    }

    /** Waits for the GIFs still being built - call before the report is flushed / the JVM exits. */
    public static void awaitGifs() {
        List<Future<?>> jobs;
        synchronized (pendingGifs) {
            jobs = new ArrayList<>(pendingGifs);
            pendingGifs.clear();
        }
        for (Future<?> job : jobs) {
            try {
                job.get(2, TimeUnit.MINUTES);
            } catch (Exception e) {
                System.out.println("⚠️ A recording GIF could not be finished: " + e.getMessage());
            }
        }
    }

    private void start() {
        running = true;
        timer = new Thread(() -> {
            while (running) {
                if (!FULL) {
                    // steps mode: sleep until a step is highlighted (captureNow), then one frame of it
                    LockSupport.park();
                    if (!running || Thread.currentThread().isInterrupted()) {
                        return;
                    }
                    if (lastStepAt > lastGrabStartedAt) {
                        grab();
                    }
                    continue;
                }
                long started = System.currentTimeMillis();
                grab();
                long wait = INTERVAL_MS - (System.currentTimeMillis() - started);
                if (wait > 0) {
                    LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(wait)); // captureNow() wakes it early
                }
                // but never grab back to back: each screenshot holds the browser for the test's next
                // command, and a step's highlight stays up 1.5 s, so it is in the next frame anyway
                long gap = MIN_GAP_MS - (System.currentTimeMillis() - started);
                if (gap > 0) {
                    LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(gap));
                }
                if (Thread.currentThread().isInterrupted()) {
                    return;
                }
            }
        }, "browser-recorder");
        timer.setDaemon(true);
        timer.start();
    }

    private void stop() {
        running = false;
        timer.interrupt();
        try {
            timer.join(3000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        grab(); // one last frame, so the recording ends on the state the test finished in
        encoder.submit(this::finishFrames);
        encoder.shutdown();
        try {
            encoder.awaitTermination(30, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** Synchronized so the timer and a step never hit the driver with two screenshots at once. */
    private synchronized void grab() {
        lastGrabStartedAt = System.nanoTime();
        // read before the picture: a step is counted once its box is up, so this frame shows at least that box
        int step = MethodHandlesWeb.currentStepNumber();
        byte[] image = screenshot();
        if (image == null || Arrays.equals(image, lastGrab)) {
            return; // nothing taken, or nothing changed - the previous frame just lasts longer
        }
        lastGrab = image;
        long takenAt = System.currentTimeMillis();
        try {
            encoder.submit(() -> encode(image, takenAt, step));
        } catch (Exception ignored) {
            // encoder already shut down - recording is stopping
        }
    }

    private byte[] screenshot() {
        try {
            if (useCdp) {
                Map<String, Object> result = ((ChromiumDriver) driver).executeCdpCommand(
                        "Page.captureScreenshot", Map.of("format", "jpeg", "quality", 80));
                return Base64.getDecoder().decode((String) result.get("data"));
            }
            return ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
        } catch (Exception e) {
            if (useCdp && !(e instanceof org.openqa.selenium.UnhandledAlertException)) {
                useCdp = false; // DevTools not available here - WebDriver screenshots from now on
            }
            return null; // alert open, page navigating, driver closing - keep the previous frame
        }
    }

    // ---------- encoder thread ----------

    private void encode(byte[] image, long takenAt, int step) {
        try {
            BufferedImage frame = ImageIO.read(new ByteArrayInputStream(image));
            if (frame == null) {
                return;
            }
            if (pendingFrame != null) {
                writeFrame(pendingFrame, FULL ? (int) (takenAt - pendingFrameTakenAt) : STEP_FRAME_MS);
            }
            pendingFrame = RecordingGif.scale(frame, FRAME_WIDTH);
            pendingFrameTakenAt = takenAt;
            pendingFrameStep = step;
            LiveFeed.frame(pendingFrame, step); // the live view's picture, when -DliveDir is set
        } catch (IOException e) {
            System.out.println("⚠️ Recording frame skipped for " + gifFile.getName() + ": " + e.getMessage());
        }
    }

    private void finishFrames() {
        try {
            if (pendingFrame != null) {
                writeFrame(pendingFrame, LAST_FRAME_MS);
                pendingFrame = null;
            }
        } catch (IOException e) {
            System.out.println("⚠️ Recording frame skipped for " + gifFile.getName() + ": " + e.getMessage());
        }
    }

    /** A frame is written once the next one arrives, because only then is its duration known. */
    private void writeFrame(BufferedImage frame, int durationMs) throws IOException {
        ImageIO.write(frame, "jpg", RecordingGif.frameFile(framesDir, frameDurations.size()));
        frameDurations.add(durationMs);
        frameSteps.add(pendingFrameStep);
        frameTimes.add(pendingFrameTakenAt);
    }

    // ---------- helpers ----------

    static void deleteFolder(File folder) {
        File[] files = folder.listFiles();
        if (files != null) {
            for (File file : files) {
                file.delete();
            }
        }
        folder.delete();
    }
}
