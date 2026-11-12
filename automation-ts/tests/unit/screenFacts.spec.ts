import { expect, test } from '@playwright/test';
import { screenFactsLine } from '../../src/phone/screenFacts';

/** Test 8094 run 579: a phone failure says what the screen showed (its words and its ticked boxes), never a typed value. */
test('the screen words come once each, in order, with the ticked boxes named', () => {
  const xml = `<hierarchy><node text="" content-desc="Please enter your account information"/>
    <node resource-id="server_checkbox_Live" checkable="true" checked="true" content-desc="Live"/>
    <node resource-id="server_checkbox_Test" checkable="true" checked="false" content-desc="Test"/>
    <node class="android.widget.EditText" text="secret-typed" resource-id="password_text_field"/>
    <node text="Account code is not correct"/><node text="Account code is not correct"/></hierarchy>`;
  expect(screenFactsLine(xml)).toBe('Phone screen at the failure: Please enter your account information | Live | Test | '
    + 'Account code is not correct - ticked: Live');
});

test('a long screen is cut', () => {
  const xml = Array.from({ length: 200 }, (_, i) => `<node text="Word ${i}"/>`).join('');
  expect(screenFactsLine(xml).length).toBeLessThanOrEqual(600);
});

test('an Appium page tree (elements named by class) gives its words too', () => {
  const xml = '<hierarchy><android.view.View class="android.view.View" content-desc="Please enter your account information"/></hierarchy>';
  expect(screenFactsLine(xml)).toBe('Phone screen at the failure: Please enter your account information');
});
