/**
 * Ticking a box on a phone screen and SEEING it ticked - the rule the AI-run phone tools learned (Test 8094 session 636,
 * run 567: platform/agent-tools/trova-phone-check-tap.js + trova-phone-server-box.js), as the first part of the one shared
 * TS module (AGENT-TOOLS-TS-PLAN.md, core): a box that is a whole row ticks only at its tick, at the row's start - so its
 * start, then its end (right-to-left apps), then its middle; a small box in its middle. After each tap the state is read
 * back a few times; a box that never changes fails honestly. Platform-free: tap, read and wait come from the caller.
 */
export type Bounds = [number, number, number, number];

export interface Box {
  id: string;
  bounds: Bounds;
  checked: boolean;
}

export interface BoxTools {
  tap: (x: number, y: number) => Promise<void>;
  /** the same box read again from the screen; undefined = it left the screen */
  read: () => Promise<Box | undefined>;
  /** a short wait between reads */
  wait: () => Promise<void>;
}

const POLLS = 4;

export function tapPoints(b: Bounds): [number, number][] {
  const [l, t, r, bottom] = b;
  const h = bottom - t;
  const cy = Math.round((t + bottom) / 2);
  const middle: [number, number] = [Math.round((l + r) / 2), cy];
  if (r - l <= 2 * h) return [middle];
  return [[Math.round(l + h / 2), cy], [Math.round(r - h / 2), cy], middle];
}

/** the box's name from its id ("server_checkbox_Test" -> "Test") */
export function boxName(box: Box): string {
  return box.id.replace(/^.*(?:checkbox|box|radio)[_-]/i, '') || box.id;
}

/** ticks (want true) or unticks the box and sees it; a plain error when no tap point changed it */
export async function setChecked(box: Box, want: boolean, tools: BoxTools): Promise<void> {
  if (box.checked === want) return;
  for (const [x, y] of tapPoints(box.bounds)) {
    await tools.tap(x, y);
    for (let i = 0; i < POLLS; i++) {
      await tools.wait();
      const now = await tools.read();
      if (!now) return; // the screen moved on
      if (now.checked === want) return;
    }
  }
  throw new Error(`Trova could not ${want ? 'tick' : 'untick'} the "${boxName(box)}" box on the phone screen`);
}
