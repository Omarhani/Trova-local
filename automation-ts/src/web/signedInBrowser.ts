import { Browser, chromium, firefox, webkit } from '@playwright/test';
import { browserChoice, pickedBrowser } from './browserChoice';

const ENGINES = { chromium, firefox, webkit };

/** the browser the run asked for (TROVA_BROWSER, else the suite's browser parameter): Chrome, Edge, Firefox or Safari, hidden or visible */
export async function openBrowser(): Promise<Browser> {
  const picked = pickedBrowser();
  const choice = browserChoice(picked);
  return ENGINES[choice.engine].launch({ channel: choice.channel, headless: choice.headless }).catch((e: unknown) => {
    throw new Error(`${picked} could not start on this computer - install it, or pick another browser in the Run dialog`, { cause: e });
  });
}
