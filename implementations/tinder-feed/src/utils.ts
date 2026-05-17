export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function header(title: string): void {
  const line = "=".repeat(60);
  console.log(`\n${line}`);
  console.log(title.toUpperCase());
  console.log(`${line}\n`);
}

export function subheader(title: string): void {
  console.log(`\n--- ${title} ---\n`);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomElements<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}
