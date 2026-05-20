import { MOCK_PAGES } from "../fixtures/seed-pages.js";

export interface FetchResult {
  url: string;
  statusCode: number;
  html: string;
  bytesDownloaded: number;
}

export async function fetchPage(url: string): Promise<FetchResult | null> {
  const page = MOCK_PAGES[url];
  if (!page) {
    return null;
  }
  const html = page.html;
  return {
    url,
    statusCode: 200,
    html,
    bytesDownloaded: Buffer.byteLength(html, "utf8"),
  };
}

export function isMockUrl(url: string): boolean {
  return url in MOCK_PAGES;
}
