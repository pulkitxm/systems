import { KEYS, redis } from "../connection.js";
import { getAvailableRanges } from "./range-store.js";

const MAX_RETRIES = 10;

const ISSUE_ID_SCRIPT = `
  local current = tonumber(redis.call('HGET', KEYS[1], 'current'))
  local max = tonumber(redis.call('HGET', KEYS[1], 'max'))
  if current > max then
    return nil
  end
  redis.call('HSET', KEYS[1], 'current', current + 1)
  return current
`;

/**
 * Ticket server: issues unique pseudo-random integers via range partitioning.
 * Picks a random range, atomically reads current and increments in one Lua script.
 */
export async function getNextId(): Promise<number> {
  const ranges = await getAvailableRanges();
  if (ranges.length === 0) {
    throw new Error("All ID ranges exhausted");
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    const key = KEYS.range(range.id);

    const id = await redis.eval(ISSUE_ID_SCRIPT, 1, key);
    if (id !== null) {
      return Number(id);
    }
  }

  throw new Error("Failed to issue ID — range may be exhausted");
}

export async function getNextIds(count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(await getNextId());
  }
  return ids;
}

export async function getRangeStats(): Promise<
  Array<{ id: number; min: number; max: number; current: number; exhausted: boolean }>
> {
  const { getAllRanges } = await import("./range-store.js");
  const { isExhausted } = await import("./range-store.js");
  const ranges = await getAllRanges();
  return ranges.map((r) => ({
    id: r.id,
    min: r.min,
    max: r.max,
    current: r.current,
    exhausted: isExhausted(r),
  }));
}
