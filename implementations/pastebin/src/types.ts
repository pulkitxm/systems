export type Visibility = "PUBLIC" | "SECRET";

export interface PasteMetadata {
  uid: string;
  name: string;
  createdAt: number;
  visibility: Visibility;
  ownerId: string;
  expiresAt: number | null;
  updatedAt: number;
}

export interface CreatePasteInput {
  content: string;
  name: string;
  ownerId: string;
  visibility: Visibility;
  expiresAt?: number | null;
}

export interface PasteResult {
  uid: string;
  url: string;
  blobPath: string;
  metadata: PasteMetadata;
}

export interface CapacityEstimate {
  writesPerMonth: number;
  maxFileBytes: number;
  blobStorageTbPerMonth: number;
  readRatio: number;
  readBandwidthPbPerMonth: number;
  metaBytesPerRow: number;
  metaStorageGbPerMonth: number;
}
