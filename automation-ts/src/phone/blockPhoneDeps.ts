import { freePort } from '../core/freePort';
import { testData } from '../run/testData';
import { keptPhoneFile, runIdNow } from './keptPhone';
import { BlockPhoneDeps, RunEndDeps } from './phoneForBlock';
import { onPhone } from './phoneGone';
import { freshApp, reopenApp } from './phoneReset';
import { SignInScreen } from './screens/SignInScreen';
import { appiumAddress, attachPhone, openPhone, Phone } from './phoneSession';

/** the real phone, Appium and the run's kept-session file behind phoneForBlock */
export function blockPhoneDeps(): BlockPhoneDeps {
  const runId = runIdNow();
  return {
    kept: () => keptPhoneFile.load(runId),
    attach: attachPhone,
    open: openPhone,
    freePort,
    save: (phone, filmPort) => keptPhoneFile.save({
      runId, sessionId: phone.sessionId, filmPort, capabilities: phone.capabilities as Record<string, unknown>,
    }),
    forget: () => keptPhoneFile.forget(runId),
    reset: async (phone, keepAppData) => {
      const call = (command: string, args: Record<string, unknown>) => onPhone(() => phone.execute(command, args));
      const app = testData.mobile().appPackage;
      await (keepAppData ? reopenApp(call, app) : freshApp(call, app));
    },
    onSignIn: (phone) => SignInScreen.startsOnSignIn(phone),
    end: (phone: Phone) => phone.deleteSession().catch(() => undefined),
  };
}

/** the run's end: its kept phone session closed on Appium by its id (the block processes are gone by then) */
export function runEndDeps(): RunEndDeps {
  const runId = runIdNow();
  return {
    kept: () => keptPhoneFile.load(runId),
    endKept: async (kept) => {
      const a = appiumAddress();
      const base = `http://${a.hostname}:${a.port}${a.path.replace(/\/$/, '')}`;
      await fetch(`${base}/session/${encodeURIComponent(kept.sessionId)}`, { method: 'DELETE', signal: AbortSignal.timeout(15_000) });
    },
    forget: () => keptPhoneFile.forget(runId),
  };
}
