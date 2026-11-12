import { expect, test } from '@playwright/test';
import { chromeArgs, chromePath } from '../../src/web/chromePath';

const slash = (p: string | undefined) => p?.split(String.fromCharCode(92)).join('/');

test("Chrome on Windows: Program Files, then the user's own install", () => {
  const env = { ProgramFiles: 'C:/Program Files', 'ProgramFiles(x86)': 'C:/Program Files (x86)', LOCALAPPDATA: 'C:/Users/u/AppData/Local' };
  const at = (want: string) => (p: string) => slash(p) === want;
  expect(slash(chromePath('headlessChrome', 'win32', env, at('C:/Program Files/Google/Chrome/Application/chrome.exe')))).toBe('C:/Program Files/Google/Chrome/Application/chrome.exe');
  expect(slash(chromePath('headlessChrome', 'win32', env, at('C:/Users/u/AppData/Local/Google/Chrome/Application/chrome.exe')))).toBe('C:/Users/u/AppData/Local/Google/Chrome/Application/chrome.exe');
});

test('Edge when the run asked for Edge', () => {
  const env = { 'ProgramFiles(x86)': 'C:/Program Files (x86)' };
  expect(slash(chromePath('headlessEdge', 'win32', env, (p) => slash(p) === 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')))
    .toBe('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
});

test('Chrome on a Mac and on Linux', () => {
  expect(chromePath('headlessChrome', 'darwin', {}, (p) => p === '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))
    .toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  expect(chromePath('headlessChrome', 'linux', {}, (p) => p === '/usr/bin/google-chrome')).toBe('/usr/bin/google-chrome');
});

test('no browser found = undefined (the run then uses a browser of its own per block, as before)', () => {
  expect(chromePath('headlessChrome', 'win32', {}, () => false)).toBeUndefined();
});

test('the shared browser starts hidden, on 127.0.0.1 only, in its own profile, at the run window size, never throttled', () => {
  expect(chromeArgs(9222, 'P', { width: 1920, height: 1080 })).toEqual(['--headless=new', '--remote-debugging-port=9222',
    '--remote-debugging-address=127.0.0.1', '--user-data-dir=P', '--no-first-run', '--no-default-browser-check',
    '--window-size=1920,1080', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding', 'about:blank']);
});
