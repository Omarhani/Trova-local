import { elements } from './pageTree';

/**
 * Plain facts about the phone screen when a phone test fails (Test 8094 run 579): its words (texts and descriptions, once
 * each, in order) and which boxes are ticked - never what was typed into a text box.
 */
export function screenFactsLine(xml: string): string {
  const words: string[] = [];
  const ticked: string[] = [];
  for (const get of elements(xml)) {
    const desc = get('content-desc').trim();
    const text = /EditText/.test(get('class')) ? '' : get('text').trim();
    for (const w of [desc, text]) if (w && !words.includes(w)) words.push(w);
    if (get('checkable') === 'true' && get('checked') === 'true') ticked.push(desc || text || get('resource-id'));
  }
  const line = `Phone screen at the failure: ${words.join(' | ')}${ticked.length ? ` - ticked: ${ticked.join(', ')}` : ''}`;
  return line.length > 600 ? `${line.slice(0, 597)}...` : line;
}

