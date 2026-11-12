/**
 * Omar 2026-11-12 (Test 8094 run 881): a block whose suite or block parameter says trap=true is a trap - wrong on purpose,
 * it must fail. Trova's one trap rule (the API's TrapMarks) also reads the test and block names; this is only the parameter.
 */
export function trapBlock(params: Record<string, string> | undefined): boolean {
  return (params?.trap ?? '').trim().toLowerCase() === 'true';
}
