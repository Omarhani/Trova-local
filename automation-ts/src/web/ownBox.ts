import { Locator } from '@playwright/test';

/**
 * The box shows and is itself enabled and editable: it is typed into even when a list row around it is marked
 * aria-disabled (the employee list's search box, Test 8094 run 631) - as Java's sendKeys does. A box that is itself
 * disabled or read-only gives false: it is typed into the strict way and fails as that step.
 */
export async function ownBoxReady(found: Locator, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  await found.waitFor({ state: 'visible', timeout: ms });
  return found.evaluate((e) => {
    const box = e as HTMLInputElement;
    return !box.disabled && !box.readOnly && !box.closest('fieldset[disabled]');
  }, undefined, { timeout: Math.max(1, until - Date.now()) }).catch(() => false);
}

/**
 * The box is a password box (its own type): read once it is on the page, within ms. A box that never came is taken as
 * one - a value is never shown for a box nobody could look at.
 */
export async function passwordBox(found: Locator, ms: number): Promise<boolean> {
  return found.evaluate((e) => (e as HTMLInputElement).type === 'password', undefined, { timeout: ms }).catch(() => true);
}
