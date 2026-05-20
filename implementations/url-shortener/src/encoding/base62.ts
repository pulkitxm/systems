import { CHAR_TO_BIT, getBitsForChar, getCharForBits } from "./char-map.js";

/**
 * Encode integer ID to short code using 6-bit chunks and shuffled map.
 * Example from slides: ID 79 → binary 1001111 → pad 000001 001111 → "bp" (sequential)
 * With shuffled map, output differs but decode round-trips.
 */
export function encode(id: number, useShuffled = true): string {
  if (id < 0 || !Number.isInteger(id)) {
    throw new Error("ID must be a non-negative integer");
  }
  if (id === 0) return getCharForBits(0, useShuffled);

  let binary = id.toString(2);
  const pad = (6 - (binary.length % 6)) % 6;
  binary = "0".repeat(pad) + binary;

  let result = "";
  for (let i = 0; i < binary.length; i += 6) {
    const chunk = binary.slice(i, i + 6);
    const value = parseInt(chunk, 2);
    result += getCharForBits(value, useShuffled);
  }
  return result;
}

export function decode(code: string, useShuffled = true): number {
  let binary = "";
  for (const char of code) {
    const bits = useShuffled ? CHAR_TO_BIT[char] : getBitsForChar(char, false);
    if (bits === undefined || bits < 0) {
      throw new Error(`Invalid character in short code: ${char}`);
    }
    binary += bits.toString(2).padStart(6, "0");
  }
  return parseInt(binary, 2);
}

/** Walkthrough steps for demo (ID 79 example from slides) */
export function encodeWalkthrough(id: number): {
  id: number;
  binary: string;
  paddedBinary: string;
  chunks: Array<{ bits: string; decimal: number; char: string }>;
  sequentialCode: string;
  shuffledCode: string;
} {
  let binary = id.toString(2);
  const pad = (6 - (binary.length % 6)) % 6;
  const paddedBinary = "0".repeat(pad) + binary;

  const chunks: Array<{ bits: string; decimal: number; char: string }> = [];
  for (let i = 0; i < paddedBinary.length; i += 6) {
    const bits = paddedBinary.slice(i, i + 6);
    const decimal = parseInt(bits, 2);
    chunks.push({
      bits,
      decimal,
      char: getCharForBits(decimal, true),
    });
  }

  return {
    id,
    binary: id.toString(2),
    paddedBinary,
    chunks,
    sequentialCode: encode(id, false),
    shuffledCode: encode(id, true),
  };
}
