import { expect, test } from '@playwright/test';
import { modeOf } from '../../src/run/runMode';

test('full screen mode from the suite\'s mode parameter: ui, full ui, screens', () => {
  for (const v of ['ui', 'UI', 'full ui', 'Full UI', 'fullui', 'full-ui', 'screen', 'screens']) expect(modeOf(v)).toBe('ui');
});

test('hybrid is the mode when the suite says hybrid, nothing, or a placeholder', () => {
  for (const v of ['hybrid', 'Hybrid', '', undefined, '${mode}', 'api']) expect(modeOf(v)).toBe('hybrid');
});
