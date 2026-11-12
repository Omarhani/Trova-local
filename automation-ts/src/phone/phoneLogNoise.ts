/**
 * The phone system's own lines written inside the app's process - drawing, frames, keyboard, hidden-API notes, security audit - that are
 * not the app's problems. A new kind of noise is one more entry here.
 */
const NOISE_TAGS = [
  /^chatty$/, /^OpenGLRenderer$/, /^Choreographer$/, /^HWUI$/i, /^libEGL$/, /^EGL_emulation$/, /^Adreno/i, /^Gralloc/i, /^qdgralloc$/,
  /^ViewRootImpl/, /^InputMethodManager/, /^IInputConnectionWrapper$/, /^ziparchive$/, /^nativeloader$/, /^vndksupport$/,
  /^BLASTBufferQueue$/, /^BufferQueueProducer$/, /^FrameEvents$/, /^SurfaceComposerClient$/, /^AudioTrack$/, /^Perf$/,
  /^ResourcesManager$/, /^ProfileInstaller$/, /^DecorView/, /^MSHandlerLifeCycle$/, /^TextView$/, /^HiTouch/, /^auditd?$/,
];
const NOISE_TEXT = [/^Accessing hidden (method|field)/, /^Long monitor contention/, /^Method .* not found/, /^Unable to open '.*\.dm'/,
  /^type=\d+ audit\(/, /\bavc: +(denied|granted)\b/]; // the phone's security audit (SELinux), any app

export function isNoise(tag: string, text: string): boolean {
  return NOISE_TAGS.some((t) => t.test(tag)) || NOISE_TEXT.some((t) => t.test(text));
}
