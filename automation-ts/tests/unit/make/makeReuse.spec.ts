import { expect, test } from '@playwright/test';
import { fileAt, made, projectCode } from './makeFixtures';

/**
 * Make automation - reuse, never duplicate: a step whose element and action an existing method already does calls that
 * method (whatever name the AI gave the element); only a truly missing one is added, once, to its page class.
 */
const INVOICES = 'src/web/pages/InvoicesPage.ts';

test('steps the page class already does call its existing methods', () => {
  const d = made('reuse');
  expect(d.refused).toBeUndefined();
  for (const m of ['openInvoices', 'clickNewInvoice', 'enterNotes', 'clickSave']) {
    expect(d.reused).toContain(`InvoicesPage.${m}`);
    expect(d.spec.text).toContain(`.${m}(`);
  }
});

test('the same element under another name is reused, never written again', () => {
  const d = made('reuse'); // step 3 calls the notes field "Note text"; InvoicesPage has it as enterNotes (By.id('iNotes'))
  expect(d.reused).toContain('InvoicesPage.enterNotes');
  expect(fileAt(d, INVOICES)).toBeDefined();
  expect(d.added.some((m) => /note/i.test(m))).toBe(false);
  expect(fileAt(d, INVOICES)?.text.match(/'iNotes'|"iNotes"/g)).toHaveLength(1);
});

test('a missing element is added once to its page class, even when two steps use it under two names', () => {
  const d = made('reuse'); // steps 4 and 5: "Discount" and "Discount %", the same field
  expect(d.added).toHaveLength(1);
  expect(d.added[0]).toMatch(/^InvoicesPage\.\w+$/);
  const page = fileAt(d, INVOICES);
  expect(page?.isNew).toBe(false);
  expect(page?.text.split("@formcontrolname='discount'")).toHaveLength(2); // one field for it
  const method = d.added[0].split('.')[1];
  expect(d.spec.text.split(`.${method}(`)).toHaveLength(3); // called by both steps
});

test('the page class keeps every line it had; the new part is added, nothing else changes', () => {
  const before = projectCode().find((f) => f.path === INVOICES)?.text ?? '';
  const after = fileAt(made('reuse'), INVOICES)?.text ?? '';
  const kept = after.split(/\r?\n/);
  for (const line of before.split(/\r?\n/)) expect(kept).toContain(line);
  expect(kept.length).toBeGreaterThan(before.split(/\r?\n/).length);
});

test('a class with no new part is not in the draft at all', () => {
  const d = made('reuse');
  const changed = d.files.map((f) => f.path);
  expect(changed).toEqual([INVOICES]);
});
