const HEAD_END = Buffer.from('\r\n\r\n');
const LENGTH = /content-length:\s*(\d+)/i;

/**
 * The pictures of the phone's picture stream (UiAutomator2's MJPEG server: parts of a multipart answer, each with its
 * Content-Length): pieces of the stream in, whole JPEGs out - the reader of utils.MobileScreenRecorder.readStream.
 */
export class MjpegParts {
  private rest: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): Buffer[] {
    this.rest = this.rest.length ? Buffer.concat([this.rest, chunk]) : chunk;
    const out: Buffer[] = [];
    for (;;) {
      const headEnd = this.rest.indexOf(HEAD_END);
      if (headEnd < 0) return out;
      const length = Number(LENGTH.exec(this.rest.subarray(0, headEnd).toString('latin1'))?.[1] ?? 0);
      const start = headEnd + HEAD_END.length;
      if (length > 0 && this.rest.length < start + length) return out; // the picture is not all here yet
      if (length > 0) out.push(Buffer.from(this.rest.subarray(start, start + length)));
      this.rest = this.rest.subarray(start + length);
    }
  }
}
