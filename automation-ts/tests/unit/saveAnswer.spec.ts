import { expect, test } from '@playwright/test';
import { refusedBy } from '../../src/web/pages/saveAnswer';

/**
 * Run 721: a refused save fails at once with the app's words. Runs 733 / 737: the app's success message
 * ("تمت العملية بنجاح") shows while the drawer is still closing - it is never a refusal.
 */
test('the success message is not a refusal, in Arabic or English', () => {
  expect(refusedBy('تمت العملية بنجاح')).toBe(false);
  expect(refusedBy('Operation completed successfully')).toBe(false);
  expect(refusedBy('')).toBe(false);
});

test('the app\'s refusal is one', () => {
  expect(refusedBy('موعد الحضور يجب ان يكون اقل من موعد الإنصراف')).toBe(true);
});
