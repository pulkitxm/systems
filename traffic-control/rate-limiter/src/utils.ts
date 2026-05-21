import type { RateLimitResult } from "./connection.js";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function header(title: string): void {
  console.log("\n" + "=".repeat(64));
  console.log(title);
  console.log("=".repeat(64));
}

export function formatResult(result: RateLimitResult): string {
  const status = result.allowed ? "ALLOWED " : "REJECTED";
  const remaining = `remaining=${result.remaining}/${result.limit}`;
  const retry = result.retryAfterMs
    ? ` retry=${result.retryAfterMs}ms`
    : "";
  return `${status}  ${remaining}${retry}`;
}

export async function fireRequests(
  label: string,
  total: number,
  check: () => Promise<RateLimitResult>,
  delayMs = 0
): Promise<{ allowed: number; rejected: number }> {
  let allowed = 0;
  let rejected = 0;
  console.log(`\n[${label}] firing ${total} requests ${delayMs ? `(delay ${delayMs}ms)` : "(burst)"}:`);
  for (let i = 0; i < total; i++) {
    const r = await check();
    console.log(`  #${String(i + 1).padStart(3, "0")}  ${formatResult(r)}`);
    if (r.allowed) allowed++;
    else rejected++;
    if (delayMs) await sleep(delayMs);
  }
  console.log(`  → allowed=${allowed}  rejected=${rejected}`);
  return { allowed, rejected };
}
