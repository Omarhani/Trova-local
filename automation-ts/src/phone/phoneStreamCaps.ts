/**
 * The phone streams its screen to this computer's port for the run's film (base.PhoneOptions sets the same): 5 pictures
 * a second; at Java's size (half the screen) over USB, with better pictures than Java's (quality 75, Java 50); over Wi-Fi
 * (an ip:port phone) smaller ones, as the stream shares the link with every command.
 */
export function streamCapabilities(port: number, udid: string | undefined): Record<string, number> {
  const wifi = Boolean(udid?.includes(':'));
  return {
    'appium:mjpegServerPort': port,
    'appium:settings[mjpegServerFramerate]': 5,
    'appium:settings[mjpegScalingFactor]': wifi ? 35 : 50,
    'appium:settings[mjpegServerScreenshotQuality]': wifi ? 50 : 75,
  };
}
