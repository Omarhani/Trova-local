import { Channel } from './kindOf';
import { MadeRun } from './madeRun';

/** what the suite blocks of a made test need */
export interface BlockPlan {
  run: MadeRun;
  channel: Channel;
  method: string;
  cleanUp?: string;
  spec: string;
  trap: string;
}

const GROUP: Record<Channel, string | undefined> = { web: 'Web', phone: 'Mob', api: undefined };

function xml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function block(name: string, params: [string, string][], group: string | undefined, path: string, method: string): string {
  return [
    `    <test name="${xml(name)}">`,
    ...params.map(([k, v]) => `        <parameter name="${xml(k)}" value="${xml(v)}"/>`),
    ...(group ? [`        <groups><run><include name="${group}"/></run></groups>`] : []),
    '        <classes>',
    `            <class name="ts:${path}">`,
    `                <methods><include name="${method}"/></methods>`,
    '            </class>',
    '        </classes>',
    '    </test>',
  ].join('\n');
}

/** the block's values: its login, full screen mode, the phone's kept sign-in, the case values (never a secret) */
function params(p: BlockPlan): [string, string][] {
  const out: [string, string][] = [['signedInAs', p.run.login]];
  if (p.run.mode === 'ui') out.push(['mode', 'ui']);
  if (p.channel === 'phone') out.push(['keepAppData', 'true']);
  return [...out, ...Object.entries(p.run.values)];
}

/**
 * The blocks for the tester's suite - "Case <id> - <title>", then its clean-up - and apart from them the trap's proof
 * blocks, which never go into the suite.
 */
export function suiteBlocks(p: BlockPlan): { suiteBlocks: string; trapBlocks: string } {
  const title = `${p.run.title}`.replace(/\s+/g, ' ').trim();
  const write = (path: string, method: string, tail: string): string => [
    block(`Case ${p.run.caseId} - ${title}${tail}`, params(p), GROUP[p.channel], path, method),
    ...(p.cleanUp ? [block(`Clean up - ${title}${tail}`, params(p), undefined, path, p.cleanUp)] : []),
  ].join('\n\n');
  return { suiteBlocks: write(p.spec, p.method, ''), trapBlocks: write(p.trap, `${p.method}Trap`, ' - trap run') };
}
