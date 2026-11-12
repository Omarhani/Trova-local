package base;

import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.options.UiAutomator2Options;
import utils.MobileScreenRecorder;
import utils.MobileSession;
import utils.PhoneConnection;

import java.util.HashMap;
import java.util.Map;

/** How a phone session starts and what it gives back: its settings, the app, the phone's usual keyboard. */
final class PhoneOptions {

    private static final String GBOARD_PACKAGE = "com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME";

    private PhoneOptions() {
    }

    /** savedLoginKey: the saved-login key of the run's user; null = no user yet */
    static UiAutomator2Options forRun(utils.TestData.Mobile mobile, String savedLoginKey) {
        if (mobile.appPackage() == null || mobile.appPackage().isBlank()) {
            throw new IllegalStateException("No app for the " + utils.TestData.env() + " environment: add its package and start screen in Trova → Test Data → Environments → Mobile app");
        }
        UiAutomator2Options options = new UiAutomator2Options();
        options.setDeviceName("Android");
        options.setAutomationName("UiAutomator2");
        options.setPlatformName("Android");
        // USB when the cable is in, wireless adb otherwise (PhoneConnection)
        String udid = PhoneConnection.udid();
        options.setUdid(udid);
        options.autoGrantPermissions();
        options.ignoreHiddenApiPolicyError();
        options.setCapability("appium:unicodeKeyboard", true);
        options.setCapability("appium:resetKeyboard", true);
        options.setCapability("appium:disableWindowAnimation", true);
        // 0: an app screen with an endless animation never lets the app go idle, so any wait here was paid in
        // full on every command (~4 s each). The click helpers verify each tap themselves.
        options.setCapability("appium:waitForIdleTimeout", 0);
        options.setAppActivity(mobile.appActivity());
        options.setAppPackage(mobile.appPackage());
        // A saved login for the run's user: loginOnPhone writes it back and starts the app itself, so the
        // session must not start the app too - that showed the app open, close and open again.
        // Every <test> block is a new session, so this is where the extra start came from.
        if (savedLoginKey != null && MobileSession.hasSaved(savedLoginKey)) {
            options.setCapability("appium:autoLaunch", false);
            System.out.println("Session starts without the app: the saved phone login will start it");
        }
        options.setEnforceAppInstall(false);
        // the phone streams its screen here for the report's recording (MobileScreenRecorder)
        options.setCapability("appium:mjpegServerPort", MobileScreenRecorder.MJPEG_PORT);
        // the recorder keeps at most 4 frames a second; the phone's default 10 was work for nothing
        options.setCapability("appium:settings[mjpegServerFramerate]", 5);
        if (PhoneConnection.isWifi(udid)) {
            // smaller frames: over Wi-Fi the stream shares the link with every command
            options.setCapability("appium:settings[mjpegScalingFactor]", 35);
            options.setCapability("appium:settings[mjpegServerScreenshotQuality]", 40);
        }
        return options;
    }

    static void giveTheKeyboardBack(AndroidDriver androidDriver) {
        try {
            // unicodeKeyboard swaps in Appium's keyboard; give the phone its usual one (GBoard) back
            System.out.println("Attempting to reset keyboard to GBoard via ADB...");
            Map<String, Object> args = new HashMap<>();
            args.put("command", "ime set " + GBOARD_PACKAGE);
            androidDriver.executeScript("mobile: shell", args);
            System.out.println("Keyboard reset command sent successfully.");
        } catch (Exception e) {
            // Log the error but don't fail the test. The driver still needs to quit.
            System.err.println("Could not reset keyboard to GBoard via ADB: " + e.getMessage());
        }
    }
}
