import { emit } from '../report/liveEvents';
import { LogLine } from './phoneProblems';
import { PhoneLogFeed } from './phoneLogFeed';
import { Phone } from './phoneSession';

/** how often the phone's log is read during a case: cheap (only the lines since the last read) and soon enough to watch */
const READ_EVERY_MS = 3000;

/**
 * Reads the phone's log during the case for the run screen's Problems and Network (PhoneLogFeed), one read at a time;
 * the returned stop does the last read and says what was left. Never fails the case.
 */
export function watchPhoneLog(phone: Phone, appPackage: string): () => Promise<void> {
  const feed = new PhoneLogFeed({
    readLog: async () => (await phone.getLogs('logcat')) as LogLine[],
    appPids: async () => pidsOf(String(await phone.execute('mobile: shell', { command: 'pidof', args: [appPackage] }))),
    appPackage,
    emit,
    since: phoneTimeNow(phone),
  });
  let busy: Promise<void> = Promise.resolve();
  let reading = false;
  const timer = setInterval(() => {
    if (reading) return;
    reading = true;
    busy = feed.drain().catch(() => undefined).finally(() => { reading = false; });
  }, READ_EVERY_MS);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await busy;
    await feed.finish().catch(() => undefined);
  };
}

/** the phone's own clock now, as its log writes it ("MM-DD HH:MM:SS"); undefined when it cannot be read */
async function phoneTimeNow(phone: Phone): Promise<string | undefined> {
  const said = String(await phone.execute('mobile: shell', { command: 'date', args: ['+%m-%d_%H:%M:%S'] }).catch(() => '')).trim();
  return /^\d\d-\d\d_\d\d:\d\d:\d\d$/.test(said) ? said.replace('_', ' ') : undefined;
}

/** "4321 5555\n" - the app's processes; none when it is not running */
export function pidsOf(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number);
}
