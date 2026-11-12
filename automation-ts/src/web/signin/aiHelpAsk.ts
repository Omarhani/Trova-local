import { Page } from '@playwright/test';
import { emit } from '../../report/liveEvents';
import { HelpAnswer } from '../../run/aiHelp/helpAnswer';
import { RunnerHelp } from '../../run/aiHelp/runnerHelp';
import { StuckAt, stuckWhere as firstFrameOutside } from '../../run/aiHelp/stuckAt';

export { causeWords, firstLine } from '../../run/aiHelp/helpAnswer';
export type { HelpAnswer } from '../../run/aiHelp/helpAnswer';
export type { StuckAt } from '../../run/aiHelp/stuckAt';

type Emit = (type: string, fields: Record<string, unknown>) => void;

/** page code: a visible dialog asking for a one-time code (or a one-time-code box) */
const CODE_BOX = `(() => { const DIALOG = '[role=dialog], [role=alertdialog], dialog[open], .modal.show, .mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane, .ant-modal, .p-dialog, .swal2-popup';
  const seen = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  if ([...document.querySelectorAll('input[autocomplete="one-time-code"]')].some(seen)) return true;
  return [...document.querySelectorAll(DIALOG)].filter(seen).some((d) => /رمز|تحقق|otp|one.?time|verif|code/i.test(d.innerText || '') && !!d.querySelector('input')); })()`;

/** the framework's own frames: a stuck step is named by the first frame outside them */
const NOT_OURS = /[\\/](node_modules|src[\\/]web[\\/]signin|src[\\/]web[\\/]webActions\.ts|src[\\/]web[\\/]covers\.ts)[\\/:]|^\s*at (async )?(new )?Promise|node:internal/;

/**
 * A stuck web step asks Trova's runner for AI help - the TS twin of utils.AiHelpAsk (Omar 2026-10-25): the runner's AI
 * works in this same browser (the run's DevTools address, its "cdp" line). The ask and its answer file: RunnerHelp
 * (the phone asks the same way, phone/phoneHelpAsk). Only in a Trova run with the run's one browser.
 */
export class AiHelpAsk {
  private readonly help: RunnerHelp;

  constructor(liveDir: string | undefined = process.env.TROVA_LIVE_DIR?.trim() || undefined,
              private readonly on: () => boolean = () => !!process.env.TROVA_BROWSER_CDP,
              waitMs = 150_000,
              pollMs = 500,
              say: Emit = emit) {
    this.help = new RunnerHelp(liveDir, waitMs, pollMs, say);
  }

  /** asks the runner and waits for its answer; null = no AI help in this run */
  async ask(page: Page, failed: Error, where: StuckAt): Promise<HelpAnswer | null> {
    if (!this.help.on() || !this.on()) return null;
    console.log('A step is stuck - the test waits while Trova\'s AI helps in this browser');
    return this.help.ask(where, failed, { url: safe(() => page.url()), title: await page.title().catch(() => ''),
      codeBox: await page.evaluate(CODE_BOX).catch(() => false) === true });
  }
}

/** the page step that got stuck: the first frame outside the framework's web helpers ("LeavesPage.save") */
export function stuckWhere(stack: string | undefined): string {
  return firstFrameOutside(stack, NOT_OURS);
}

function safe(read: () => string): string {
  try { return read(); } catch { return ''; }
}
