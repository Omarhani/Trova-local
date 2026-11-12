import { expect, test } from '@playwright/test';
import { Phone } from '../../src/phone/phoneSession';
import { HomeScreen } from '../../src/phone/screens/HomeScreen';

/**
 * Test 8094 run 1001 (suite 68, case 4227): the app was opened again and home was still loading its attendance card -
 * neither Check-In nor Check-Out showed within 10 s - and that was read as "not checked in". The case then waited 60 s
 * for a Check-In that could never come; the screen at the failure showed Check-Out with "Check in" as the last activity.
 * A home that shows neither is never a "no": it is waited for, and a plain failure when it never comes.
 */
const LOADING = '<hierarchy><android.widget.Button content-desc="Self Services" bounds="[0,0][200,100]"/></hierarchy>';
const CHECK_OUT = `<hierarchy><android.widget.ImageView resource-id="checkout_button" bounds="[395,1246][685,1537]"/>
  <android.view.View content-desc="Check in" bounds="[0,600][200,650]"/></hierarchy>`;
const CHECK_IN = '<hierarchy><android.widget.ImageView resource-id="checkin_button" bounds="[395,1246][685,1537]"/></hierarchy>';

/** a phone that shows these screens one look after the other (the last one stays), 0.2 s a look like the real one */
function phoneShowing(...screens: string[]): Phone {
  let look = 0;
  return {
    getPageSource: async () => screens[Math.min(look++, screens.length - 1)],
    pause: async (ms: number) => new Promise((r) => setTimeout(r, ms)),
    takeScreenshot: async () => '',
  } as unknown as Phone;
}

test('red first (run 1001): a home that never shows Check-In or Check-Out is a plain failure, never "not checked in"', async () => {
  const seen = await new HomeScreen(phoneShowing(LOADING)).offersCheckOut(1).catch((e: Error) => e);
  expect(seen).toBeInstanceOf(Error);
  expect((seen as Error).message).toBe('Home showed neither Check-In nor Check-Out within 1 s');
});

test('a home still loading its attendance card is waited for: Check-Out once it shows and stays', async () => {
  expect(await new HomeScreen(phoneShowing(LOADING, LOADING, LOADING, CHECK_OUT)).offersCheckOut(10)).toBe(true);
});

test('a home that settles on Check-In is "not checked in"', async () => {
  expect(await new HomeScreen(phoneShowing(LOADING, CHECK_IN)).offersCheckOut(10)).toBe(false);
});

test('a home that flips from an older state to Check-Out is read on the state it stays on', async () => {
  expect(await new HomeScreen(phoneShowing(CHECK_IN, CHECK_OUT)).offersCheckOut(15)).toBe(true);
});
