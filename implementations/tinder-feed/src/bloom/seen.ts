import { redis, KEYS } from "../connection.js";

const BLOOM_ERROR_RATE = 0.01;
const BLOOM_CAPACITY = 10000;

export class SeenProfilesFilter {
  async initializeFilter(userId: string): Promise<void> {
    const key = KEYS.SEEN(userId);
    const exists = await redis.exists(key);
    if (!exists) {
      await redis.call(
        "BF.RESERVE",
        key,
        BLOOM_ERROR_RATE,
        BLOOM_CAPACITY,
        "NONSCALING"
      );
    }
  }

  async markAsSeen(userId: string, candidateId: string): Promise<void> {
    const key = KEYS.SEEN(userId);
    try {
      await redis.call("BF.ADD", key, candidateId);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("not exist")
      ) {
        await this.initializeFilter(userId);
        await redis.call("BF.ADD", key, candidateId);
      } else {
        throw error;
      }
    }
  }

  async hasSeen(userId: string, candidateId: string): Promise<boolean> {
    const key = KEYS.SEEN(userId);
    try {
      const result = await redis.call("BF.EXISTS", key, candidateId);
      return result === 1;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("not exist")
      ) {
        return false;
      }
      throw error;
    }
  }

  async hasSeenMany(
    userId: string,
    candidateIds: string[]
  ): Promise<Map<string, boolean>> {
    const key = KEYS.SEEN(userId);
    const results = new Map<string, boolean>();

    if (candidateIds.length === 0) {
      return results;
    }

    try {
      const existsResults = (await redis.call(
        "BF.MEXISTS",
        key,
        ...candidateIds
      )) as number[];
      for (let i = 0; i < candidateIds.length; i++) {
        results.set(candidateIds[i], existsResults[i] === 1);
      }
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("not exist")
      ) {
        for (const id of candidateIds) {
          results.set(id, false);
        }
      } else {
        throw error;
      }
    }

    return results;
  }

  async getFilterInfo(
    userId: string
  ): Promise<{ capacity: number; size: number; filters: number } | null> {
    const key = KEYS.SEEN(userId);
    try {
      const info = (await redis.call("BF.INFO", key)) as (string | number)[];
      const result: Record<string, number> = {};
      for (let i = 0; i < info.length; i += 2) {
        result[info[i] as string] = info[i + 1] as number;
      }
      return {
        capacity: result["Capacity"] || 0,
        size: result["Size"] || 0,
        filters: result["Number of filters"] || 0,
      };
    } catch {
      return null;
    }
  }

  async deleteFilter(userId: string): Promise<void> {
    await redis.del(KEYS.SEEN(userId));
  }
}

export const seenProfilesFilter = new SeenProfilesFilter();
