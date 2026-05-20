import { SPIDER } from "../config.js";

const HREF_RE =
  /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

export function extractLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links: string[] = [];

  let match: RegExpExecArray | null;
  HREF_RE.lastIndex = 0;
  while ((match = HREF_RE.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;

    try {
      const resolved = new URL(href, base).href;
      if (SPIDER.HTTP_ONLY && !resolved.startsWith("http://") && !resolved.startsWith("https://")) {
        continue;
      }
      if (!seen.has(resolved)) {
        seen.add(resolved);
        links.push(resolved);
      }
    } catch {
      // invalid URL
    }
  }

  return links;
}
