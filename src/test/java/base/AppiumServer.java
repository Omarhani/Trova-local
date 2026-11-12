package base;

import io.appium.java_client.service.local.AppiumDriverLocalService;
import io.appium.java_client.service.local.AppiumServiceBuilder;

/** The Appium server of a phone suite: started before it, stopped after it. */
final class AppiumServer {

    private static AppiumDriverLocalService service;

    private AppiumServer() {
    }

    static void start() {
        System.out.println("Launching Appium in the background...");

        AppiumServiceBuilder builder = new AppiumServiceBuilder()
                .withIPAddress("127.0.0.1")
                .usingPort(4723)
                // mobile: shell (MobileSession, keyboard reset) needs adb_shell allowed
                .withArgument(() -> "--allow-insecure", "uiautomator2:adb_shell")
                // every command with its time ("<-- POST /element 200 1429 ms"), to see where a slow run goes;
                // copied to target/appium.log below (Appium's own --log file stays empty: it is killed at the end)
                .withArgument(() -> "--log-timestamp")
                .withArgument(() -> "--log-no-colors")
                // default 20 s: loading the drivers can take longer under Maven;
                // start() returns as soon as the server listens, so a fast start loses nothing
                .withTimeout(java.time.Duration.ofSeconds(60));

        service = AppiumDriverLocalService.buildService(builder);
        try {
            new java.io.File("target").mkdirs();
            service.addOutPutStream(new java.io.FileOutputStream("target/appium.log"));
        } catch (java.io.IOException e) {
            System.out.println("⚠️ No target/appium.log: " + e.getMessage());
        }
        service.start(); // Starts the server completely in the background

        System.out.println("Appium Server is up and running safely!");
    }

    static void stop() {
        if (service != null && service.isRunning()) {
            service.stop();
            System.out.println("Appium Server stopped cleanly.");
        }
    }
}
