import { Page } from '@playwright/test';
import { afterEachCheck } from '../report/checks';
import { liveFrames } from '../report/liveFrames';
import { currentStep } from '../report/stepNumbers';
import { onStandIn } from './signin/standIn';
import { clearMarks } from './stepMark';
import { webShot } from './webPicture';

type Keep = (picture: Buffer, step: number) => Promise<unknown>;
type Take = (page: Page) => Promise<Buffer>;

const screenshot: Take = (page) => webShot(page);

/**
 * One picture for every web step and check, as Java's recorder keeps one per step (Omar 2026-11-10: run 609 case 340
 * had 15 steps and 6 pictures). A picture is taken in the background, one after another per page, and its step's
 * marks come off once it is taken; the next step waits only for the picture before it (Java: beforeStep), so a mark
 * is never in another step's picture. A run without a picture folder draws nothing and takes nothing.
 */
export class StepPictures {
  private readonly last = new WeakMap<Page, Promise<void>>();

  constructor(private keep: Keep | undefined, private take: Take = screenshot) {}

  /** where the pictures go (undefined = no pictures) and how they are taken */
  keepWith(keep: Keep | undefined, take: Take = screenshot): void {
    this.keep = keep;
    this.take = take;
  }

  on(): boolean {
    return this.keep !== undefined;
  }

  /** the picture of the step (or check) just done; never waited for by the step itself */
  shoot(page: Page, step: number): void {
    const keep = this.keep;
    if (!keep) return;
    const before = this.last.get(page) ?? Promise.resolve();
    const now = before.then(async () => {
      if (onStandIn(page.url())) return; // Trova's own sign-in stand-in is never in a picture
      const shot = await this.take(page).catch(() => undefined);
      if (shot) await keep(shot, step).catch(() => undefined);
      await clearMarks(page, step);
    });
    this.last.set(page, now);
  }

  /** the pictures asked for on this page are taken */
  async done(page: Page): Promise<void> {
    await this.last.get(page);
  }
}

/** the run's pictures: into the run's picture folder, every one kept */
export const stepPictures = new StepPictures(liveFrames.on() ? (shot, step) => liveFrames.add(shot, step, 'jpg', true) : undefined);

/** a picture after every check of the test on this page; gives back how to stop */
export function picturesAfterChecks(page: Page): () => void {
  const stop = afterEachCheck(() => stepPictures.shoot(page, currentStep()));
  return () => { stop(); };
}
