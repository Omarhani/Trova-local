import { MASK, secretField, SecretValues, secretValues } from './secretValues';

/** what a Type / Select step carries: the value, or *** with the secret's reference */
export type ValueFields = { v: string; secret?: true; ref?: string };

/** the step's value fields for what was typed or chosen in the field (element = its name, selector = its locator,
 *  passwordBox = the box itself is a password box) */
export function typedValue(element: string, selector: string, value: string, passwordBox = false, secrets: SecretValues = secretValues): ValueFields {
  if (!value || !(passwordBox || secretField(element, selector))) return { v: value };
  return { v: MASK, secret: true, ref: secrets.keep(value) };
}
