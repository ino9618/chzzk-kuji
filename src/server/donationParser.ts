export function extractNumbers(message: string): number[] {
  const matches = message.match(/\d+/g);
  if (!matches) return [];
  return matches.map((m) => parseInt(m, 10));
}
