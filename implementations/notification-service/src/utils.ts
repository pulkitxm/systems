export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function header(title: string): void {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

export function subheader(title: string): void {
  console.log("\n" + "-".repeat(40));
  console.log(`  ${title}`);
  console.log("-".repeat(40));
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function printStats(label: string, stats: object): void {
  console.log(`\n📊 ${label}:`);
  for (const [key, value] of Object.entries(stats)) {
    const formattedKey = key.replace(/([A-Z])/g, " $1").toLowerCase();
    console.log(`  ${formattedKey}: ${value}`);
  }
}
