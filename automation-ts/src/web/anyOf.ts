import { Locator, Page } from '@playwright/test';

const MARK = 'trova-anyof=';

/** the XPath of a locator written with By.xpath or By.id (or a bare "//..."); undefined for any other kind */
function xpathOf(selector: string): string | undefined {
  if (selector.startsWith('xpath=')) return selector.slice(6);
  const id = /^css=\[id="([^"]*)"\]$/.exec(selector); // By.id
  if (id) return `//*[@id="${id[1]}"]`;
  return selector.startsWith('//') || selector.startsWith('(//') ? selector : undefined;
}

/** an XPath from the document's root: safe inside another's [not(...)] */
const absolute = (x: string): boolean => x.startsWith('/') || x.startsWith('(/');

/**
 * One locator for an app that comes in more than one design (old and new layout, mobile and desktop menu, a language
 * that moves things): the first option that matches on the page now - the TS twin of utils.AnyOf. Order the likeliest
 * first. XPath options become one XPath (works everywhere a selector does); with another kind in it the page objects'
 * actions find it through locate().
 */
export function anyOf(...options: string[]): string {
  if (options.length === 0) throw new Error('AnyOf needs at least one locator');
  if (options.length === 1) return options[0];
  const xpaths = options.map(xpathOf);
  if (xpaths.every((x): x is string => x !== undefined && absolute(x))) {
    return 'xpath=' + xpaths.map((x, i) => `(${x})` + (i === 0 ? '' : `[${xpaths.slice(0, i).map((e) => `not(${e})`).join(' and ')}]`)).join(' | ');
  }
  return MARK + JSON.stringify(options);
}

/** the page's matches of a selector, an anyOf of mixed kinds too (its first option on the page now) */
export function locate(page: Page, selector: string): Locator {
  if (!selector.startsWith(MARK)) return page.locator(selector);
  const options = JSON.parse(selector.slice(MARK.length)) as string[];
  return options.map((o) => page.locator(o)).reduce((all, next) => all.or(next));
}
