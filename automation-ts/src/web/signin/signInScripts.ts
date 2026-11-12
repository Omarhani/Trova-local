import { Page } from '@playwright/test';

/**
 * The page code a sign-in reads with - the same code as the AI agent's tools (trova-browser.js FIND_SRC,
 * trova-login-field.js, trova-login-signed.js) and the Java helpers (utils.ScreenSignIn.FIND, SignInPage), so a run and
 * an AI session read a sign-in page alike. Each is a function body that takes its values as arguments[0..]. Never
 * reads or returns a typed value.
 */

/** the agent's finder: css, text=<button text>, x:has-text("...") - visible elements only; the element or null */
export const FIND = String.raw`var sel = arguments[0];
var seen = function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
var byText = function (scope, text) { text = text.trim().replace(/^['"]|['"]$/g, '').toLowerCase(); var all;
  try { all = Array.prototype.slice.call(document.querySelectorAll(scope || '*')); } catch (e) { return []; }
  return all.filter(function (e) { return seen(e) && ((e.innerText || e.value || '') + '').trim().toLowerCase().indexOf(text) >= 0; }); };
var best = function (list, text) { text = text.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  var exact = function (e) { return ((e.innerText || e.value || '') + '').trim().toLowerCase() === text; };
  var on = function (e) { return !e.disabled && e.getAttribute('aria-disabled') !== 'true'; };
  var pick = function (f) { for (var k = 0; k < list.length; k++) if (f(list[k])) return list[k]; return null; };
  return pick(function (e) { return exact(e) && on(e); }) || pick(exact) || pick(on) || list[0]; };
var parts = String(sel).split(/,(?![^(]*\))/).map(function (s) { return s.trim(); }).filter(Boolean);
for (var i = 0; i < parts.length; i++) { var one = parts[i];
  var t = /^text=([\s\S]+)$/.exec(one);
  if (t) { var b = best(byText('button, a, [role=button], input[type=submit], input[type=button]', t[1]), t[1]); if (b) return b; continue; }
  var h = /^([\s\S]*?):has-text\((['"])([\s\S]*)\2\)$/.exec(one);
  if (h) { var l = byText(h[1] || '*', h[3]); if (l.length) return l[l.length - 1]; continue; }
  try { var e = document.querySelector(one); if (e) return e; } catch (x) {} }
return null;`;

/** the shared page helpers (trova-login-field.js HELPERS) */
const HELPERS = String.raw`var DIALOG = '[role=dialog], [role=alertdialog], dialog[open], .modal.show, .modal.in, .mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane, .swal2-popup, .ant-modal, .p-dialog, .el-dialog';
var OTP = /otp|one-time-code|one.?time|verif|code|pin|رمز|تحقق/i;
var seen = function (e) { var r = e.getBoundingClientRect(); var s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.disabled; };
var boxes = function () { return Array.prototype.slice.call(document.querySelectorAll('input, textarea')).filter(function (e) {
  return seen(e) && !e.readOnly && ['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].indexOf(e.type) < 0; }); };
var words = function (e) { return [e.name, e.id, e.placeholder, e.getAttribute('aria-label'), e.getAttribute('formcontrolname'), e.autocomplete,
  e.labels && e.labels[0] && e.labels[0].innerText].filter(Boolean).join(' '); };
var ACCOUNT = /account|company|client|org|tenant|user|e-?mail|حساب|منشأة|شركة|اسم|المستخدم/i;
var STRONG = /otp|one-time-code|one.?time|verif|تحقق|sms/i;
var otpLike = function (e) { return e.autocomplete === 'one-time-code' || (!ACCOUNT.test(words(e))
  && (STRONG.test(words(e)) || (OTP.test(words(e)) && !!e.closest(DIALOG)) || e.maxLength === 1)); };
`;

/** {pw, login, path, mid}: a password box, a login address, a code box half-way through the sign-in */
export const STATE = HELPERS + String.raw`var all = boxes(); var path = location.pathname + location.hash;
var login = /(^|[/#])(log-?in|sign-?in|signin|auth|sso)([/?#]|$)/i.test(path);
var dialogCode = Array.prototype.slice.call(document.querySelectorAll(DIALOG)).filter(seen).some(function (d) {
  return /رمز|تحقق|otp|code|verif/i.test(d.innerText || '') && all.some(function (e) { return d.contains(e); }); });
return { pw: all.some(function (e) { return e.type === 'password'; }), login: login, path: path,
  mid: dialogCode || all.some(function (e) { return otpLike(e) && (e.closest(DIALOG) || login); }) };`;

/** the done sign shows: arguments[0] = done, [1] = its words */
export const DONE = `var find = function () { ${FIND} };` + String.raw`
var d = arguments[0]; if (location.href.indexOf(d) >= 0) return true;
try { if (find.apply(null, [d])) return true; } catch (e) { /* not a selector */ }
var norm = function (s) { return String(s || '').normalize('NFKC').replace(/[ً-ٰٟـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/\s+/g, '').toLowerCase(); };
var want = norm(arguments[1]);
return want.length > 1 && norm(document.body ? document.body.innerText : '').indexOf(want) >= 0;`;

/** the signed-in shell: a side menu with links, else a user menu; its selector or null */
export const SHELL = String.raw`var seen = function (e) { var r = e.getBoundingClientRect(); var s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
var links = function (e) { return Array.prototype.slice.call(e.querySelectorAll('a[href], [routerlink], [role=menuitem], li')).filter(seen).length; };
var MENU = ['aside', 'mat-sidenav', '.sidebar', '.side-menu', '.sidenav', '.side-nav', '[class*=sidebar]', '[class*=side-menu]', '[class*=sidenav]', 'nav', '[role=navigation]'];
var USER = ['[class*=user-menu]', '[class*=user-info]', '[class*=user-profile]', '[class*=avatar]', '[aria-label*=account i]', '[aria-label*=profile i]'];
for (var i = 0; i < MENU.length; i++) { if (Array.prototype.slice.call(document.querySelectorAll(MENU[i])).some(function (x) { return seen(x) && links(x) >= 3; })) return MENU[i]; }
for (var j = 0; j < USER.length; j++) { if (Array.prototype.slice.call(document.querySelectorAll(USER[j])).some(seen)) return USER[j]; }
return null;`;

/** a selector for the box of this kind (dialog first): arguments[0] = otp | password | other, [1] = the field's name */
export const PICK = HELPERS + String.raw`var fam = arguments[0], name = arguments[1];
var all = boxes(); var inDialog = all.filter(function (e) { return e.closest(DIALOG); });
var names = String(name).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w.length > 1; });
var pick = fam === 'otp' ? all.find(function (e) { return e.autocomplete === 'one-time-code'; }) || all.find(function (e) { return otpLike(e) && !e.value; })
    || inDialog.find(function (e) { return !e.value && !ACCOUNT.test(words(e)); })
  : fam === 'password' ? all.find(function (e) { return e.type === 'password' && !e.value; }) || all.find(function (e) { return e.type === 'password'; })
  : all.find(function (e) { return names.some(function (w) { return words(e).toLowerCase().indexOf(w) >= 0; }); }) || inDialog.find(function (e) { return !e.value; });
if (!pick) return null;
var tag = pick.tagName.toLowerCase(); var q = function (v) { return JSON.stringify(String(v)); };
var tries = [pick.id && '#' + CSS.escape(pick.id),
  pick.getAttribute('formcontrolname') && tag + '[formcontrolname=' + q(pick.getAttribute('formcontrolname')) + ']',
  pick.name && tag + '[name=' + q(pick.name) + ']',
  pick.autocomplete === 'one-time-code' && tag + '[autocomplete="one-time-code"]',
  pick.placeholder && tag + '[placeholder=' + q(pick.placeholder) + ']',
  pick.getAttribute('aria-label') && tag + '[aria-label=' + q(pick.getAttribute('aria-label')) + ']']
  .concat(pick.closest(DIALOG) ? DIALOG.split(', ').map(function (d) { return d + ' ' + tag + (pick.type ? '[type=' + pick.type + ']' : ''); }) : []);
for (var i = 0; i < tries.length; i++) { if (!tries[i]) continue; try { if (document.querySelector(tries[i]) === pick) return tries[i]; } catch (e) { /* not CSS */ } }
return null;`;

/** the confirm button of the open dialog: its text (clicked when arguments[0] is true), or null */
export const BUTTON = HELPERS + String.raw`var scope = Array.prototype.slice.call(document.querySelectorAll(DIALOG)).filter(seen).pop(); if (!scope) return null;
var NO = /إلغاء|الغاء|اغلاق|إغلاق|cancel|close|back|رجوع|إعادة|اعادة|resend/i;
var YES = /إرسال|ارسال|تأكيد|تاكيد|تحقق|دخول|متابعة|التالي|submit|send|verify|confirm|continue|next|ok|log ?in|sign ?in/i;
var text = function (b) { return (b.innerText || b.value || '').trim(); };
var list = Array.prototype.slice.call(scope.querySelectorAll('button, input[type=submit], [role=button]')).filter(function (b) { return seen(b) && !NO.test(text(b)); });
var b = list.find(function (x) { return x.type === 'submit'; }) || list.find(function (x) { return YES.test(text(x)); }) || list.filter(function (x) { return text(x); }).pop();
if (!b || !text(b)) return null; if (arguments[0]) b.click(); return text(b);`;

/** what the app says on the page: a toast, an error under a box ("" when nothing) */
export const SAID = String.raw`var l = document.querySelectorAll('.toast-message, .toast, [role=alert], .error, .invalid-feedback, mat-error, .mat-mdc-snack-bar-label, .mat-snack-bar-container, .swal2-html-container, .p-toast-detail, .ant-message-notice, [class*=toast] [class*=message]');
for (var i = 0; i < l.length; i++) { var t = (l[i].innerText || '').trim(); if (t) return t.slice(0, 200); } return '';`;

/** a function body run on the page with its arguments (an expression, so the page's own rules never block it) */
export function script(body: string, ...args: unknown[]): string {
  return `(function () { ${body}\n}).apply(null, ${JSON.stringify(args)})`;
}

/** runs a page code; undefined when the page could not be read */
export async function onPage<T>(page: Page, body: string, ...args: unknown[]): Promise<T | undefined> {
  return page.evaluate(script(body, ...args)).then((v) => v as T, () => undefined);
}
