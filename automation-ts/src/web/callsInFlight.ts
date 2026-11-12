import type { Page, Request } from '@playwright/test';

/**
 * The page's calls of one kind still waiting for their answer (run 721: a slower, earlier list load came back after the
 * filtered one and replaced the table). A page object starts it in its constructor and acts only when none is left.
 */
export class CallsInFlight {
  private open = 0;
  private readonly waiters = new Set<() => void>();

  constructor(page: Pick<Page, 'on'>, private readonly url: RegExp) {
    page.on('request', (r: Request) => { if (this.url.test(r.url())) this.open++; });
    const done = (r: Request): void => {
      if (!this.url.test(r.url())) return;
      this.open = Math.max(0, this.open - 1);
      if (this.open === 0) this.waiters.forEach((w) => w());
    };
    page.on('requestfinished', done);
    page.on('requestfailed', done);
  }

  get count(): number {
    return this.open;
  }

  /** run 723: true once none is in flight (at once when none is); false when one is still waiting after ms */
  idle(ms: number): Promise<boolean> {
    if (this.open === 0) return Promise.resolve(true);
    return new Promise((answer) => {
      const woke = (): void => { clearTimeout(limit); this.waiters.delete(woke); answer(true); };
      const limit = setTimeout(() => { this.waiters.delete(woke); answer(false); }, ms);
      this.waiters.add(woke);
    });
  }
}
