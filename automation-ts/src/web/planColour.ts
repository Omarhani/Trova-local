/** a work plan's colour from its style ("--event-color: #8e44ad;"); undefined when it has none */
export function colourOf(style: string | null | undefined): string | undefined {
  const m = /--event-color:\s*([^;]+)/.exec(style ?? '');
  return m ? m[1].trim() : undefined;
}

/** every shift style shown has the plan's colour - and at least one shows (an empty calendar is no pass) */
export function allOfColour(styles: string[], colour: string): boolean {
  return styles.length > 0 && styles.every((s) => s.includes(colour)); // as Java reads it: contains(@style, colour)
}

/** the colours the calendar's shift styles show: the plan's own when a style has it, else the style's first colour value */
export function coloursSeen(styles: string[], colour: string): string[] {
  const seen = styles.map((s) => (s.includes(colour) ? colour : (/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/i.exec(s)?.[0] ?? s.trim())));
  return [...new Set(seen)];
}
