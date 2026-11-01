// Counted nouns: "1 word", "2 words". English only; pass the plural for irregular nouns.

/** `n` with the noun in the right number: plural(1, 'word') is '1 word', plural(3, 'box', 'boxes') is '3 boxes'. */
export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : (many ?? `${one}s`)}`;
}
