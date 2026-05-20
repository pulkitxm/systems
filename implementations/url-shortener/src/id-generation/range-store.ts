import { TICKET_SERVER } from "../config.js";
import { KEYS, redis } from "../connection.js";
import type { Range } from "../types.js";

export async function initRanges(
  count = TICKET_SERVER.RANGE_COUNT,
  rangeSize = TICKET_SERVER.RANGE_SIZE
): Promise<Range[]> {
  const ranges: Range[] = [];

  for (let i = 0; i < count; i++) {
    const min = i * rangeSize;
    const max = min + rangeSize - 1;
    const range: Range = { id: i + 1, min, max, current: min };

    await redis.hset(KEYS.range(range.id), {
      min: String(min),
      max: String(max),
      current: String(min),
    });
    await redis.sadd(KEYS.rangeIndex, String(range.id));
    ranges.push(range);
  }

  return ranges;
}

export async function getAllRanges(): Promise<Range[]> {
  const ids = await redis.smembers(KEYS.rangeIndex);
  const ranges: Range[] = [];

  for (const idStr of ids.sort((a, b) => Number(a) - Number(b))) {
    const data = await redis.hgetall(KEYS.range(Number(idStr)));
    if (!data.min) continue;
    ranges.push({
      id: Number(idStr),
      min: Number(data.min),
      max: Number(data.max),
      current: Number(data.current),
    });
  }
  return ranges;
}

export async function getAvailableRanges(): Promise<Range[]> {
  const all = await getAllRanges();
  return all.filter((r) => r.current <= r.max);
}

export function isExhausted(range: Range): boolean {
  return range.current > range.max;
}

export async function resetRanges(): Promise<void> {
  const ids = await redis.smembers(KEYS.rangeIndex);
  const keys = ids.map((id) => KEYS.range(Number(id)));
  if (keys.length) await redis.del(...keys);
  await redis.del(KEYS.rangeIndex);
}
