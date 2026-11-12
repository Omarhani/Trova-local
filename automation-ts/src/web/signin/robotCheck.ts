import { Page } from '@playwright/test';

/** a frame on the page: its address and whether it shows */
export interface FrameSeen {
  url: string;
  visible: boolean;
}

const ROBOT = /google\.com\/recaptcha\/(api2|enterprise)\/(anchor|bframe)|hcaptcha\.com|challenges\.cloudflare\.com/i;

/** a robot check that blocks a sign-in: a visible "I'm not a robot" box or picture challenge (never the invisible score check) */
export function robotCheckIn(frames: FrameSeen[]): boolean {
  return frames.some((f) => f.visible && ROBOT.test(f.url) && !/[?&]size=invisible\b/i.test(f.url));
}

/** the plain reason: Trova never gets around a robot check */
export function robotWords(app: string, login: string): string {
  return `${app}'s sign-in page asks for a robot check ("I'm not a robot"), so signing in as ${login} on the screen stopped`
    + ' - Trova never gets around it: run this suite in hybrid mode (sign-in by the app\'s own calls)';
}

/** the page shows a robot check now */
export async function robotCheckShown(page: Page): Promise<boolean> {
  const frames = await page.locator('iframe').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { url: (e as HTMLIFrameElement).src, visible: r.width > 10 && r.height > 10 && getComputedStyle(e).visibility !== 'hidden' };
  })).catch(() => [] as FrameSeen[]);
  return robotCheckIn(frames);
}
