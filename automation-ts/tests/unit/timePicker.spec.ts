import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { By } from '../../src/web/by';
import { setTime } from '../../src/web/timePicker';

/** utils.TimePicker on small local pages: a native time box, a typed box and a clock dialog (installed Chrome, hidden) */
let browser: Browser;
let page: Page;

/** a read-only field whose clock dialog works like Availo's: header hour : minute, AM / PM, a round face, Cancel / OK */
const CLOCK = `<input id="t" readonly placeholder="Shift start">
<script>
document.getElementById('t').onclick = () => {
  const d = document.createElement('div');
  d.setAttribute('role', 'dialog');
  d.innerHTML = '<div class="time-frame"><span class="time">12</span>:<span class="time">00</span></div>'
    + '<div class="ampm"><span>AM</span><span>PM</span></div>'
    + '<mat-clock><div class="circle" style="display:block;width:256px;height:256px;border-radius:50%;background:#eee"></div></mat-clock>'
    + '<div class="actions"><button>Cancel</button><button>OK</button></div>';
  document.body.appendChild(d);
  let part = 0, half = 'am';
  const heads = d.querySelectorAll('.time');
  heads.forEach((h, i) => { h.onclick = () => { part = i; }; });
  d.querySelectorAll('.ampm span').forEach((s) => { s.onclick = () => { half = s.textContent.toLowerCase(); }; });
  d.querySelector('.circle').onclick = (e) => {
    const r = e.target.getBoundingClientRect();
    const a = Math.atan2(e.clientX - r.left - r.width / 2, -(e.clientY - r.top - r.height / 2));
    const turn = (a < 0 ? a + 2 * Math.PI : a) / (2 * Math.PI);
    if (part === 0) { const h = Math.round(turn * 12) % 12; heads[0].textContent = String(h === 0 ? 12 : h).padStart(2, '0'); part = 1; }
    else heads[1].textContent = String(Math.round(turn * 60) % 60).padStart(2, '0');
  };
  d.querySelectorAll('.actions button')[1].onclick = () => {
    document.getElementById('t').value = Number(heads[0].textContent) + ':' + heads[1].textContent + ' ' + half;
    d.remove();
  };
};
</script>`;

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
});

test.afterAll(async () => {
  await browser.close();
});

test('a native time box takes the time as HH:mm', async () => {
  await page.setContent('<input id="t" type="time">');
  expect(await setTime(page, By.id('t'), '6:30 pm', 2, 'Shift start')).toBe('18:30');
});

test('a box that takes typing gets the time typed, the old text emptied first', async () => {
  await page.setContent('<input id="t" value="9:00">');
  expect(await setTime(page, By.id('t'), '6 pm', 2, 'Shift start')).toBe('6 pm');
});

test('a read-only field: AM / PM, hour and minute on the clock face, then OK', async () => {
  await page.setContent(CLOCK);
  expect(await setTime(page, By.id('t'), '6:15 pm', 3, 'Shift start')).toBe('6:15 pm');
});

test('Arabic digits on the clock face', async () => {
  await page.setContent(CLOCK);
  expect(await setTime(page, By.id('t'), '٩:٣٠ ص', 3, 'Shift start')).toBe('9:30 am');
});

test('a field that is not on the screen fails in plain words', async () => {
  await page.setContent('<p>no field</p>');
  await expect(setTime(page, By.id('t'), '6 pm', 1, 'Shift start')).rejects.toThrow('The Shift start field was not on the screen within 1 s');
});

test('a wrong time fails before anything is touched', async () => {
  await page.setContent('<input id="t" value="keep">');
  await expect(setTime(page, By.id('t'), '25:00', 1)).rejects.toThrow('"25:00" is not a time - write it like 18:00 or 6:00 pm');
  expect(await page.locator('#t').inputValue()).toBe('keep');
});
