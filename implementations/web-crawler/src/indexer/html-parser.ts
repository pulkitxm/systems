/**
 * Strip script/style, remove tags, tokenize body text for inverted index.
 */

const SCRIPT_STYLE_RE =
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi;
const TAG_RE = /<[^>]+>/g;

export function stripHtmlToText(html: string): string {
  const noScript = html.replace(SCRIPT_STYLE_RE, " ");
  const noTags = noScript.replace(TAG_RE, " ");
  return noTags.replace(/\s+/g, " ").trim();
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

export function extractTokensFromHtml(html: string): string[] {
  return tokenize(stripHtmlToText(html));
}
