/**
 * Bloom Filter Implementation in TypeScript
 *
 * A Bloom filter is a probabilistic data structure that can tell you:
 * - "Definitely NOT in set" (100% certain)
 * - "Might be in set" (could be false positive)
 */

export class BloomFilter {
  private bitArray: Uint8Array;
  private size: number;
  private hashCount: number;

  /**
   * Create a new Bloom filter
   * @param size - Number of bits in the filter
   * @param hashCount - Number of hash functions to use
   */
  constructor(size: number, hashCount: number) {
    this.size = size;
    this.hashCount = hashCount;
    this.bitArray = new Uint8Array(Math.ceil(size / 8));
  }

  /**
   * Create a Bloom filter with optimal parameters
   * @param expectedElements - Expected number of elements to insert
   * @param falsePositiveRate - Desired false positive rate (e.g., 0.01 for 1%)
   */
  static createOptimal(
    expectedElements: number,
    falsePositiveRate: number
  ): BloomFilter {
    // m = -n * ln(p) / (ln(2))^2
    const size = Math.ceil(
      (-expectedElements * Math.log(falsePositiveRate)) / Math.pow(Math.log(2), 2)
    );

    // k = (m/n) * ln(2)
    const hashCount = Math.ceil((size / expectedElements) * Math.log(2));

    console.log(`Creating optimal Bloom filter:`);
    console.log(`  Expected elements: ${expectedElements.toLocaleString()}`);
    console.log(`  False positive rate: ${(falsePositiveRate * 100).toFixed(2)}%`);
    console.log(`  Calculated size: ${size.toLocaleString()} bits (${(size / 8 / 1024).toFixed(2)} KB)`);
    console.log(`  Hash functions: ${hashCount}`);
    console.log();

    return new BloomFilter(size, hashCount);
  }

  /**
   * Simple hash function using FNV-1a algorithm
   */
  private hash(value: string, seed: number): number {
    let hash = 2166136261 ^ seed;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % this.size;
  }

  /**
   * Get all hash positions for a value
   */
  private getHashPositions(value: string): number[] {
    const positions: number[] = [];
    for (let i = 0; i < this.hashCount; i++) {
      positions.push(this.hash(value, i));
    }
    return positions;
  }

  /**
   * Set a bit at a given position
   */
  private setBit(position: number): void {
    const byteIndex = Math.floor(position / 8);
    const bitIndex = position % 8;
    this.bitArray[byteIndex] |= 1 << bitIndex;
  }

  /**
   * Check if a bit is set at a given position
   */
  private getBit(position: number): boolean {
    const byteIndex = Math.floor(position / 8);
    const bitIndex = position % 8;
    return (this.bitArray[byteIndex] & (1 << bitIndex)) !== 0;
  }

  /**
   * Add an item to the Bloom filter
   */
  add(value: string): void {
    const positions = this.getHashPositions(value);
    for (const pos of positions) {
      this.setBit(pos);
    }
  }

  /**
   * Check if an item might exist in the Bloom filter
   * @returns true if the item MIGHT exist, false if it DEFINITELY doesn't exist
   */
  mightContain(value: string): boolean {
    const positions = this.getHashPositions(value);
    for (const pos of positions) {
      if (!this.getBit(pos)) {
        return false; // Definitely not in set
      }
    }
    return true; // Might be in set (could be false positive)
  }

  /**
   * Get the current fill ratio of the filter
   */
  getFillRatio(): number {
    let setBits = 0;
    for (let i = 0; i < this.size; i++) {
      if (this.getBit(i)) {
        setBits++;
      }
    }
    return setBits / this.size;
  }

  /**
   * Get filter statistics
   */
  getStats(): { size: number; hashCount: number; fillRatio: number } {
    return {
      size: this.size,
      hashCount: this.hashCount,
      fillRatio: this.getFillRatio(),
    };
  }
}
