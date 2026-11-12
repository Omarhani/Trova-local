import * as fs from 'node:fs';
import * as path from 'node:path';
import { emit } from './liveEvents';

/** at most one picture this often (utils.LiveFeed.FRAME_GAP_MS) */
const FRAME_GAP_MS = 600;
const FRAME = /^frame-(\d{6})\.(jpg|png)$/;

type Say = (type: string, fields: Record<string, unknown>) => void;

/**
 * The run screen's live Browser (and its step pictures afterwards): each picture goes into the run's picture folder
 * (TROVA_LIVE_DIR, the runner sends every announced one to Trova) as frame-000001.jpg and is announced with the step it
 * shows - the same "frame" event the Java helpers send. A run not started by Trova has no folder and sends nothing.
 * The blocks run one after another in worker processes: a worker numbers on from the pictures already in the folder.
 */
export class LiveFrames {
  private n: number | undefined;
  private last = -Infinity;

  constructor(private readonly dir: string | undefined, private readonly now: () => number = Date.now, private readonly say: Say = emit) {}

  on(): boolean {
    return Boolean(this.dir);
  }

  /** due for a picture now (callers skip taking one otherwise) */
  due(): boolean {
    return this.on() && this.now() - this.last >= FRAME_GAP_MS;
  }

  /** a picture of the step (jpg from the browser, png from the phone); a picture too soon after the last is left out -
   *  unless every: a phone picture is taken after every step and check (Test 8094 run 598: 4 pictures for 7 steps) */
  async add(picture: Buffer, step: number, kind: 'jpg' | 'png', every = false): Promise<boolean> {
    if (!this.dir || (!every && !this.due())) return false;
    this.last = this.now();
    await fs.promises.mkdir(this.dir, { recursive: true });
    this.n ??= this.highest();
    const name = `frame-${String(++this.n).padStart(6, '0')}.${kind}`;
    await fs.promises.writeFile(path.join(this.dir, name), picture);
    this.say('frame', { f: name, step });
    return true;
  }

  private highest(): number {
    let top = 0;
    for (const f of fs.readdirSync(this.dir as string)) {
      const m = FRAME.exec(f);
      if (m) top = Math.max(top, Number(m[1]));
    }
    return top;
  }
}

/** the run's pictures (one per worker process) */
export const liveFrames = new LiveFrames(process.env.TROVA_LIVE_DIR?.trim() || undefined);
