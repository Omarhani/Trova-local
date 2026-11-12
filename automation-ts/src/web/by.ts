/**
 * Locators written the way the Java page objects write them - By.xpath("...") - so Trova's App map reads, matches and
 * updates TS page objects with the same rules (one field per element: `private readonly saveButton = By.xpath("...")`).
 * Each gives a Playwright selector for the web, or a WebdriverIO selector for the phone.
 */
export const By = {
  xpath: (xpath: string): string => `xpath=${xpath}`,
  cssSelector: (css: string): string => `css=${css}`,
  id: (id: string): string => `css=[id="${id}"]`,
};

/** the phone's locators (WebdriverIO takes an XPath as it is) */
export const AppiumBy = {
  xpath: (xpath: string): string => xpath,
  accessibilityId: (id: string): string => `~${id}`,
};
