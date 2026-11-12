import { Check } from './checkWriter';
import { quote } from './names';

/**
 * The trap twin: the same test named <method>Trap, with ONE check's expected value made wrong (the last check of the
 * case). Its run must fail - proof that the test's checks really look at the result.
 */
export function trapText(spec: string, method: string, check: Check): string {
  const named = spec.replace(`test(${quote(method)},`, `test(${quote(`${method}Trap`)},`);
  const at = named.indexOf(`\n${check.line}\n`) + 1;
  if (at <= 0) throw new Error('The check to turn into a trap is not in the test');
  return `${named.slice(0, at)}${check.trap}${named.slice(at + check.line.length)}`;
}
