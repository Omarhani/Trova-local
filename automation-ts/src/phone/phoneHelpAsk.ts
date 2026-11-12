import { HelpAnswer } from '../run/aiHelp/helpAnswer';
import { RunnerHelp } from '../run/aiHelp/runnerHelp';
import { StuckAt } from '../run/aiHelp/stuckAt';
import { announcedPhone } from './phoneAnnounce';

/** where a phone step got stuck: its screen (LoginScreen), the screen's step, the element and the action */
export interface PhoneStuck extends StuckAt {
  screen: string;
  element: string;
  action: string;
}

/** asks AI help for a stuck phone step; null = no AI help in this run */
export type PhoneAid = (where: PhoneStuck, failed: Error) => Promise<HelpAnswer | null>;

/**
 * Self-healing on the phone (Omar 2026-11-11): a phone step whose element does not show asks Trova's runner for AI help
 * the same way a web step does (RunnerHelp: the "ai-help" line and the answer file), marked phone - the runner's AI
 * works on the same phone through the session the block announced (phoneAnnounce).
 */
export class PhoneHelpAsk {
  constructor(private readonly help: RunnerHelp = new RunnerHelp(),
              private readonly session: () => string | undefined = announcedPhone) {}

  async ask(where: PhoneStuck, failed: Error): Promise<HelpAnswer | null> {
    if (!this.help.on() || !this.session()) return null;
    console.log('A phone step is stuck - the test waits while Trova\'s AI helps on this phone');
    return this.help.ask(where, failed, { phone: true, screen: where.screen, element: where.element, action: where.action });
  }
}

const helper = new PhoneHelpAsk();

/** the run's phone first aid: every phone screen's steps ask through it */
export const phoneAid: PhoneAid = (where, failed) => helper.ask(where, failed);
