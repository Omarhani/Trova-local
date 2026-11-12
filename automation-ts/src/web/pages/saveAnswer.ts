/** the app's own success words, Arabic and English ("تمت العملية بنجاح", "... successfully") */
const SUCCESS = /بنجاح|success/i;

/**
 * A message the app shows after Save while its drawer is still open is a refusal only when it is not its success
 * message (runs 733 / 737: the success message comes while the drawer is still closing); no message = none
 */
export function refusedBy(message: string): boolean {
  return message.trim() !== '' && !SUCCESS.test(message);
}
