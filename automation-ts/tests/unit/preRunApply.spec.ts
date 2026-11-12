import { expect, test } from '@playwright/test';
import { applyPreRun } from '../../src/run/preRunApply';

test('the pre-run result reaches the run: stops saved, ended sign-ins refused for the run, one line and a note per problem or warning', () => {
  const saved: unknown[] = [];
  const refused: string[] = [];
  const notes: string[] = [];
  const lines: string[] = [];
  applyPreRun({ stops: { phone: 'The phone is locked' }, refused: [{ login: 'Admin', why: 'ended' }], warnings: ['ends at 04:05'] }, 1234, {
    save: (s) => saved.push(s), refuse: (l, w) => refused.push(`${l}:${w}`), note: (t) => notes.push(t), say: (l) => lines.push(l),
  });
  expect(saved).toEqual([{ phone: 'The phone is locked' }]);
  expect(refused).toEqual(['Admin:ended']);
  expect(notes).toEqual(['Before the run: The phone is locked', 'Before the run: ended', 'Before the run: ends at 04:05']);
  expect(lines[0]).toContain('1.2 s');
});

test('all ready: one quiet line, no note', () => {
  const notes: string[] = [];
  const lines: string[] = [];
  applyPreRun({ stops: {}, refused: [], warnings: [] }, 300, { save: () => undefined, refuse: () => undefined, note: (t) => notes.push(t), say: (l) => lines.push(l) });
  expect(notes).toEqual([]);
  expect(lines[0]).toContain('everything ready');
});
