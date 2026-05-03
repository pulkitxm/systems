import { redis } from "./connection.js";

const BLOOM_PREFIX = "bloom:campaign:";

export async function initBloomFilter(
  campaignId: string,
  expectedItems: number = 1_000_000,
  errorRate: number = 0.01
): Promise<void> {
  const key = `${BLOOM_PREFIX}${campaignId}`;

  const exists = await redis.exists(key);
  if (exists) return;

  await redis.call("BF.RESERVE", key, errorRate, expectedItems);
  console.log(`  🌸 Created Bloom filter for campaign ${campaignId}`);
  console.log(`     Expected items: ${expectedItems.toLocaleString()}`);
  console.log(`     Error rate: ${(errorRate * 100).toFixed(2)}%`);
}

export async function markAsSent(campaignId: string, userId: string): Promise<void> {
  const key = `${BLOOM_PREFIX}${campaignId}`;
  await redis.call("BF.ADD", key, userId);
}

export async function wasSent(campaignId: string, userId: string): Promise<boolean> {
  const key = `${BLOOM_PREFIX}${campaignId}`;

  try {
    const exists = await redis.call("BF.EXISTS", key, userId);
    return exists === 1;
  } catch {
    return false;
  }
}

export async function shouldSendNotification(
  campaignId: string,
  userId: string
): Promise<boolean> {
  const alreadySent = await wasSent(campaignId, userId);
  return !alreadySent;
}

export async function getBloomFilterInfo(campaignId: string): Promise<{
  exists: boolean;
  capacity?: number;
  size?: number;
  filterCount?: number;
  insertedCount?: number;
  expansionRate?: number;
} | null> {
  const key = `${BLOOM_PREFIX}${campaignId}`;

  try {
    const info = await redis.call("BF.INFO", key) as (string | number)[];
    const result: Record<string, number> = {};

    for (let i = 0; i < info.length; i += 2) {
      const k = String(info[i]).toLowerCase().replace(/ /g, "_");
      result[k] = Number(info[i + 1]);
    }

    return {
      exists: true,
      capacity: result.capacity,
      size: result.size,
      filterCount: result.number_of_filters,
      insertedCount: result.number_of_items_inserted,
      expansionRate: result.expansion_rate,
    };
  } catch {
    return { exists: false };
  }
}

export async function deleteBloomFilter(campaignId: string): Promise<boolean> {
  const key = `${BLOOM_PREFIX}${campaignId}`;
  const result = await redis.del(key);
  return result > 0;
}

export async function demonstrateFalsePositives(
  campaignId: string,
  testCount: number = 10000
): Promise<{ checked: number; falsePositives: number; rate: number }> {
  let falsePositives = 0;

  for (let i = 0; i < testCount; i++) {
    const fakeUserId = `nonexistent_user_${Date.now()}_${i}_${Math.random()}`;
    const result = await wasSent(campaignId, fakeUserId);
    if (result) {
      falsePositives++;
    }
  }

  return {
    checked: testCount,
    falsePositives,
    rate: falsePositives / testCount,
  };
}
