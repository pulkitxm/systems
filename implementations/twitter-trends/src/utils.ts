import { createHash } from "crypto";

export function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/gi;
  return (text.match(urlRegex) || []).map((u) => u.replace(/[.,!?]+$/, ""));
}

export function getDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return null;
  }
}

export function isAllowedNewsDomain(url: string, allowed: readonly string[]): boolean {
  const domain = getDomain(url);
  if (!domain) return false;
  return allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function timeWindowId(now = Date.now(), windowMs: number): string {
  const bucket = Math.floor(now / windowMs);
  return `w${bucket}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
