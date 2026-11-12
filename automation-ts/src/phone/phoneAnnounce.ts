import { emit } from '../report/liveEvents';
import { appiumAddress, Phone } from './phoneSession';

type Emit = (type: string, fields: Record<string, unknown>) => void;

/** the phone session this process announced (its id), for a stuck phone step's ask */
let announced: string | undefined;

/**
 * Self-healing on the phone (Omar 2026-11-11): the block's phone session goes to Trova's runner - the phone server's
 * address and the session - as the web announces its browser ("cdp"). The runner's AI works on the SAME phone through
 * this session (never a second phone server, which would end the test's own).
 */
export function announcePhone(phone: Phone, env: NodeJS.ProcessEnv = process.env, say: Emit = emit): void {
  const a = appiumAddress(env);
  const caps = (phone.capabilities ?? {}) as Record<string, unknown>;
  const udid = String(caps['appium:udid'] ?? caps.udid ?? '');
  announced = phone.sessionId;
  say('appium', { addr: `http://${a.hostname}:${a.port}${a.path.endsWith('/') ? a.path : `${a.path}/`}`, session: phone.sessionId, udid });
}

/** the announced phone session; undefined = none in this process (no AI help on the phone) */
export function announcedPhone(): string | undefined {
  return announced;
}
