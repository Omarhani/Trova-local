import * as path from 'node:path';
import { CACHE_BYTES } from './browserCache';

/**
 * The installed browser the run asked for (Chrome, or Edge for "Edge"), started by the run itself so every block can
 * join it (Playwright's own launch keeps its default tab from other connections). undefined = not found.
 */
export function chromePath(picked: string, platform: string, env: Record<string, string | undefined>, exists: (file: string) => boolean): string | undefined {
  const edge = picked.toLowerCase().includes('edge');
  const join = platform === 'win32' ? path.win32.join : path.posix.join;
  const win = (root: string | undefined, ...rest: string[]): string[] => (root ? [join(root, ...rest)] : []);
  const candidates = platform === 'win32'
    ? (edge
      ? [...win(env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'), ...win(env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]
      : [...win(env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'), ...win(env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
        ...win(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')])
    : platform === 'darwin'
      ? [edge ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : edge ? ['/usr/bin/microsoft-edge', '/opt/microsoft/msedge/msedge'] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome'];
  return candidates.find(exists);
}

/** hidden (or visible when the run asked), DevTools on 127.0.0.1 only, its own profile, the run's window size, never slowed down;
 *  cacheDir = the app's downloads kept from earlier runs (browserCache) */
export function chromeArgs(port: number, profile: string, size: { width: number; height: number }, headless = true, cacheDir?: string): string[] {
  const cache = cacheDir ? [`--disk-cache-dir=${cacheDir}`, `--disk-cache-size=${CACHE_BYTES}`] : [];
  return [...(headless ? ['--headless=new'] : []), `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', `--window-size=${size.width},${size.height}`,
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', ...cache, 'about:blank'];
}
