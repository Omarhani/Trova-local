package utils;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import java.util.List;

/**
 * Omar 2026-10-27: a quick look right after "Log in programmatically" - a page that opens signed in but unstyled (a menu
 * without colours, the app's colour settings empty, no styles at all) usually means a page setting the sign-in page
 * writes first (theme, language ...) is missing. It only notes what it saw, in plain words; it never fails the run.
 */
final class PageLook {

    /** Omar 2026-10-27 (session 270: did not fire): wider menu match, colour settings from the variables the styles use. Page code: what looks unstyled now (empty list = looks fine) - the same look as agent-tools' trova-page-look.js */
    static final String SCRIPT = """
            return (() => {
              const seen = [];
              const clear = (c) => !c || c === 'transparent' || /^rgba\\(0, 0, 0, 0\\)$/.test(c);
              const plain = new Set(['rgb(0, 0, 0)', 'rgb(0, 0, 238)', 'rgb(85, 26, 139)']);
              if (!document.styleSheets.length && !document.querySelector('[style]')) seen.push('no styles are loaded on the page');
              const menus = [...document.querySelectorAll('nav, aside, [role=navigation], [class*=sidebar i], [class*=side-menu i], [class*=sidenav i], [class*=menu i]')]
                .filter((m) => m.getBoundingClientRect().height > 100 && m.querySelectorAll('a, li, button').length >= 3);
              const menu = menus.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
              if (menu) {
                const items = [...menu.querySelectorAll('a, li, button')].slice(0, 80);
                let backs = 0; const colours = new Set();
                for (const e of items) { const s = getComputedStyle(e); if (!clear(s.backgroundColor) || s.backgroundImage !== 'none') backs++; colours.add(s.color); }
                if (!backs && (colours.size <= 1 || [...colours].every((c) => plain.has(c)))) seen.push('the side menu has no colours and no item looks picked');
              }
              const used = new Set();
              for (const sheet of [...document.styleSheets]) {
                let rules; try { rules = sheet.cssRules; } catch { continue; }
                for (const r of [...(rules || [])].slice(0, 4000)) for (const m of (r.cssText || '').matchAll(/var\\((--[\\w-]+)/g)) used.add(m[1]);
              }
              const root = getComputedStyle(document.documentElement), body = document.body ? getComputedStyle(document.body) : root;
              const names = [...used].slice(0, 300);
              const empty = names.filter((n) => !root.getPropertyValue(n).trim() && !body.getPropertyValue(n).trim()).length;
              if (names.length >= 3 && empty / names.length >= 0.8) seen.push("the app's colour settings are empty");
              return seen;
            })();""";

    private PageLook() {
    }

    /** prints a plain note when the signed-in page looks unstyled */
    static void note(WebDriver driver) {
        try {
            Object seen = ((JavascriptExecutor) driver).executeScript(SCRIPT);
            if (seen instanceof List<?> list && !list.isEmpty()) {
                System.out.println("Note: the page looks unstyled after signing in (" + String.join("; ", list.stream().map(String::valueOf).toList())
                        + "). A page setting the sign-in page writes first (theme, language ...) may be missing from the sign-in.");
            }
        } catch (RuntimeException e) {
            // a look only - never stops the run
        }
    }
}
