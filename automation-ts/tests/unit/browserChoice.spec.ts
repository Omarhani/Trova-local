import { expect, test } from '@playwright/test';
import { browserChoice, pickedBrowser } from '../../src/web/browserChoice';

test('Chrome, Edge, Firefox and Safari open visible; headless ones hidden (base.BrowserStart)', () => {
  expect(browserChoice('Chrome')).toEqual({ engine: 'chromium', channel: 'chrome', headless: false });
  expect(browserChoice('Edge')).toEqual({ engine: 'chromium', channel: 'msedge', headless: false });
  expect(browserChoice('Firefox')).toEqual({ engine: 'firefox', headless: false });
  expect(browserChoice('Safari')).toEqual({ engine: 'webkit', headless: false });
  expect(browserChoice('headlessChrome')).toEqual({ engine: 'chromium', channel: 'chrome', headless: true });
  expect(browserChoice('HEADLESSEDGE')).toEqual({ engine: 'chromium', channel: 'msedge', headless: true });
  expect(browserChoice('headlessFirefox')).toEqual({ engine: 'firefox', headless: true });
  expect(browserChoice('headlessSafari')).toEqual({ engine: 'webkit', headless: true });
});

test('an unfilled ${browserType} is Chrome; nothing picked is hidden Chrome', () => {
  expect(browserChoice('${browserType}')).toEqual({ engine: 'chromium', channel: 'chrome', headless: false });
  expect(browserChoice('')).toEqual({ engine: 'chromium', channel: 'chrome', headless: true });
});

test('an unknown browser fails in plain words', () => {
  expect(() => browserChoice('Opera')).toThrow('Unknown browser "Opera": use Chrome, Edge, Firefox, Safari, headlessChrome, headlessEdge, headlessFirefox or headlessSafari');
});

test("the run's own pick first, then the suite's browser parameter, then hidden Chrome", () => {
  expect(pickedBrowser({ TROVA_BROWSER: 'headlessEdge' }, { browser: 'Firefox' })).toBe('headlessEdge');
  expect(pickedBrowser({}, { browser: 'Firefox' })).toBe('Firefox');
  expect(pickedBrowser({ TROVA_BROWSER: ' ' }, { browser: '${browser}' })).toBe('headlessChrome');
  expect(pickedBrowser({}, {})).toBe('headlessChrome');
});
