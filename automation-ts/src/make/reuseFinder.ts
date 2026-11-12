import { IndexedClass, IndexedMethod } from './codeIndex';
import { ROW } from './locatorKey';
import { UiAction } from './methodWriter';

/** an existing method a step can call instead of a new one */
export interface Found {
  cls: IndexedClass;
  method: IndexedMethod;
}

function first(classes: IndexedClass[], match: (m: IndexedMethod) => boolean): Found | undefined {
  for (const cls of classes) {
    const method = cls.methods.find(match);
    if (method) return { cls, method };
  }
  return undefined;
}

/** the method that does this action on this element - by its locator, whatever name the AI or the class gave it */
export function reusedAction(classes: IndexedClass[], action: UiAction, key: string): Found | undefined {
  const row = key.includes(ROW);
  const params = (action === 'type' ? 1 : 0) + (row ? 1 : 0);
  return first(classes, (m) => m.action === action && m.key === key && m.params === params && !!m.row === row);
}

/** the page's own open method (open..., no values) that names this address */
export function reusedOpen(classes: IndexedClass[], page: string): Found | undefined {
  return first(classes, (m) => /^open[A-Z]/.test(m.name) && m.params === 0
    && (m.body.includes(`'${page}'`) || m.body.includes(`"${page}"`)));
}

/** the method that makes this known call of the app */
export function reusedCall(classes: IndexedClass[], endpoint: string): Found | undefined {
  const want = endpoint.toLowerCase();
  return first(classes, (m) => m.endpoint?.toLowerCase() === want);
}
