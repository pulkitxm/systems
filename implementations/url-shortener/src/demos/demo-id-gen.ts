import { connectRedis, closeConnection } from "../connection.js";
import { encode } from "../encoding/base62.js";
import { initRanges, resetRanges } from "../id-generation/range-store.js";
import { getNextIds, getRangeStats } from "../id-generation/ticket-server.js";
import { TICKET_SERVER } from "../config.js";

async function main(): Promise<void> {
  console.log("=== Demo: Ticket Server — Pseudo-Random ID Generation ===\n");

  await connectRedis();
  await resetRanges();
  await initRanges(TICKET_SERVER.RANGE_COUNT, TICKET_SERVER.RANGE_SIZE);

  console.log("Ranges (partitioned ID space):");
  const statsBefore = await getRangeStats();
  for (const s of statsBefore) {
    console.log(`  Range ${s.id}: ${s.min} – ${s.max}`);
  }

  console.log("\nIssue 15 IDs (random range pick → non-sequential order):");
  const ids = await getNextIds(15);
  console.log(`  Raw IDs:    ${ids.join(", ")}`);
  console.log(`  Encoded:    ${ids.map((id) => encode(id)).join(", ")}`);

  const sequential = Array.from({ length: 15 }, (_, i) => i);
  console.log(`\n  If sequential: ${sequential.join(", ")}`);
  console.log("  Ticket server IDs jump across ranges → harder to scrape");

  console.log("\nRange state after issuance:");
  const statsAfter = await getRangeStats();
  for (const s of statsAfter) {
    const issued = s.current - s.min;
    console.log(`  Range ${s.id}: current=${s.current}, issued=${issued}`);
  }

  await closeConnection();
}

main().catch(console.error);
