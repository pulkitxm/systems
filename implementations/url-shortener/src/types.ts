export interface UrlRecord {
  shortCode: string;
  url: string;
  userId: string;
  createdAt: string;
}

export interface Range {
  id: number;
  min: number;
  max: number;
  current: number;
}

export interface ShortenResult {
  shortCode: string;
  shortUrl: string;
  id: number;
}

export interface ApproachComparison {
  approach: string;
  shortCode: string;
  length: number;
  predictable: boolean;
  sameUrlSameCode: boolean;
  notes: string[];
}
