import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { AiHelpAsk, stuckWhere } from '../../src/web/signin/aiHelpAsk';

/** Java utils.AiHelpAsk: the stuck step asks Trova's runner ("ai-help" live line), the answer comes back as a file. */

const page = { url: () => 'https://app.x/leaves', title: async () => 'Leaves', evaluate: async () => false } as never;

function folder(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trova-aihelp-'));
}

test('the ask goes to the runner as one "ai-help" line and the runner\'s answer file is read and removed', async () => {
  const dir = folder();
  const lines: Record<string, unknown>[] = [];
  const ask = new AiHelpAsk(dir, () => true, 2_000, 20, (t, f) => {
    lines.push({ t, ...f });
    if (t === 'ai-help') fs.writeFileSync(path.join(dir, `ai-help-${f.n}.json`), JSON.stringify({ ok: true, did: 'closed a dialog', why: null, cause: 'OUR_CODE', proof: 'a news dialog covered the page' }));
  });
  const a = await ask.ask(page, new Error('Timeout 5000ms exceeded\ncall log ...'), { step: 'LeavesPage.save', test: 'add a leave' });
  expect(a).toEqual({ helped: true, did: 'closed a dialog', why: undefined, cause: 'OUR_CODE', proof: 'a news dialog covered the page' });
  expect(lines[0]).toMatchObject({ t: 'ai-help', step: 'LeavesPage.save', test: 'add a leave', problem: 'Timeout 5000ms exceeded', url: 'https://app.x/leaves', title: 'Leaves', codeBox: false });
  expect(lines[1]).toMatchObject({ t: 'step', a: 'AI help', e: 'AI helped: closed a dialog · cause: our test code - a news dialog covered the page', c: 'LeavesPage.save' });
  expect(fs.readdirSync(dir)).toEqual([]);
});

test('no answer in time: not helped, with the plain reason', async () => {
  const ask = new AiHelpAsk(folder(), () => true, 100, 20, () => undefined);
  expect(await ask.ask(page, new Error('x'), { step: 's', test: 't' })).toEqual({ helped: false, did: '', why: 'AI help did not answer within 2 minutes' });
});

test('outside a Trova run with its browser there is no AI help - nothing is asked', async () => {
  let asked = 0;
  const ask = new AiHelpAsk(undefined, () => true, 100, 20, () => { asked++; });
  expect(await ask.ask(page, new Error('x'), { step: 's', test: 't' })).toBeNull();
  const off = new AiHelpAsk(folder(), () => false, 100, 20, () => { asked++; });
  expect(await off.ask(page, new Error('x'), { step: 's', test: 't' })).toBeNull();
  expect(asked).toBe(0);
});

test('the stuck step is the first frame outside the framework\'s own helpers', () => {
  const stack = ['Error', '    at SignedOutStep.once (D:\\p\\automation-ts\\src\\web\\signin\\signedOutStep.ts:40:11)',
    '    at LeavesPage.click (D:\\p\\automation-ts\\src\\web\\webActions.ts:20:5)',
    '    at LeavesPage.save (D:\\p\\automation-ts\\src\\web\\pages\\leavesPage.ts:12:5)',
    '    at D:\\p\\automation-ts\\tests\\web\\leaves.spec.ts:9:3',
    '    at node_modules\\playwright\\lib\\x.js:1:1'].join('\n');
  expect(stuckWhere(stack)).toBe('LeavesPage.save');
  expect(stuckWhere('Error')).toBe('a step');
});
