import { BASE_URL } from "./config.js";
import { encode } from "./encoding/base62.js";
import { getNextId } from "./id-generation/ticket-server.js";
import { resolveUrl, storeUrl } from "./storage/url-store.js";
import type { ShortenResult, UrlRecord } from "./types.js";

export async function shortenUrl(
  originalUrl: string,
  userId: string
): Promise<ShortenResult> {
  const id = await getNextId();
  const shortCode = encode(id, true);
  await storeUrl(shortCode, originalUrl, userId);

  return {
    shortCode,
    shortUrl: `${BASE_URL}/${shortCode}`,
    id,
  };
}

export async function resolveShortUrl(shortCode: string): Promise<UrlRecord | null> {
  return resolveUrl(shortCode);
}
