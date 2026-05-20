/**
 * Shuffled 6-bit character map — known only to the server.
 * 62 chars (a-z, A-Z, 0-9) ≈ 2^6, so each character encodes 6 bits.
 *
 * Sequential map (predictable): 000000→a, 000001→b, ...
 * Shuffled map (harder to guess): 000000→q, 000001→d, ...
 */

const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Fisher-Yates shuffle with fixed seed for reproducible demos */
function shuffledAlphabet(seed = 42): string {
  const chars = ALPHABET.split("");
  let s = seed;
  for (let i = chars.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export const SHUFFLED_MAP = shuffledAlphabet();

/** index (0-61) → character */
export const BIT_TO_CHAR: string[] = SHUFFLED_MAP.split("");

/** character → index (0-61) */
export const CHAR_TO_BIT: Record<string, number> = Object.fromEntries(
  BIT_TO_CHAR.map((c, i) => [c, i])
);

/** Sequential map for comparison demos */
export const SEQUENTIAL_MAP = ALPHABET;

export function getCharForBits(bits: number, useShuffled = true): string {
  const map = useShuffled ? BIT_TO_CHAR : SEQUENTIAL_MAP.split("");
  return map[bits & 0x3f];
}

export function getBitsForChar(char: string, useShuffled = true): number {
  if (useShuffled) return CHAR_TO_BIT[char] ?? -1;
  return SEQUENTIAL_MAP.indexOf(char);
}
