/** the home greeting the app should show for firstName, in the language it shows ("أهلا Omar" / "Welcome Omar") */
export function expectedGreeting(shown: string, firstName: string): string {
  return `${shown.startsWith('أهلا') ? 'أهلا' : 'Welcome'} ${firstName}`;
}
