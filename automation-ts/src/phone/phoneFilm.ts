/** where a kept picture goes: the run's pictures (liveFrames.add), every = never left out for being too soon; true = kept */
export type KeepPicture = (jpeg: Buffer, step: number, every: boolean) => Promise<boolean>;

/**
 * The phone's film for the run screen, as the Java phone suites make it (utils.MobileScreenRecorder): the pictures the
 * phone streams by itself, each new one kept with the step on screen (the run's pictures keep one every 600 ms at most),
 * the same picture as the last KEPT one left out - a new screen left out for being too soon is kept by its next picture.
 * After a step the next picture is always kept for it (run 598: a picture after every step and check). It never asks the phone for anything - the test's own calls are never slowed down.
 */
export class PhoneFilm {
  /** the film of the phone test now running (the screen actions ask it for their step pictures) */
  static current: PhoneFilm | undefined;

  private last: Buffer | undefined;
  private lastKept: Buffer | undefined;
  private step = 0;
  private stepWanted: number | undefined;

  constructor(private readonly keep: KeepPicture) {}

  /** a step started: the pictures from now on show it */
  atStep(step: number): void {
    this.step = step;
  }

  /** the step just done wants the next picture; false when no picture came yet (the caller takes its own) */
  stepPicture(step: number): boolean {
    if (!this.last) return false;
    this.step = step;
    this.stepWanted = step;
    return true;
  }

  async frame(jpeg: Buffer): Promise<void> {
    const wanted = this.stepWanted;
    this.last = jpeg;
    if (wanted !== undefined) {
      this.stepWanted = undefined;
      if (await this.keep(jpeg, wanted, true)) this.lastKept = jpeg;
    } else if (!this.lastKept?.equals(jpeg) && await this.keep(jpeg, this.step, false)) {
      this.lastKept = jpeg;
    }
  }
}
