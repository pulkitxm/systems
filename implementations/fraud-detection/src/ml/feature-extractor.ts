import type { FeatureVector, Transaction, TransactionRequest } from "../types.js";

const REGION_MAP: Record<string, number> = {
  "IN-MH": 1,
  "IN-KA": 2,
  "IN-DL": 3,
  "IN-TN": 4,
  "US-CA": 5,
};

const LOCATION_MAP: Record<string, number> = {
  Mumbai: 1,
  Bangalore: 2,
  Delhi: 3,
  Chennai: 4,
  Pune: 5,
  SanFrancisco: 6,
};

const BANK_MAP: Record<string, number> = {
  HDFC: 1,
  SBI: 2,
  ICICI: 3,
  AXIS: 4,
  PNB: 5,
  CHASE: 6,
  BOA: 7,
  CITI: 8,
  BARCLAYS: 9,
  DEUTSCHE: 10,
  GRAMMARLY: 11,
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 100;
}

export function encodeRegion(region: string): number {
  return REGION_MAP[region] ?? hashCode(region);
}

export function encodeLocation(location: string): number {
  return LOCATION_MAP[location] ?? hashCode(location);
}

export function encodeBank(bank: string): number {
  return BANK_MAP[bank] ?? hashCode(bank);
}

export function extractFeatures(
  txn: Transaction | TransactionRequest
): FeatureVector {
  const hour =
    "hourOfDay" in txn && txn.hourOfDay !== undefined
      ? txn.hourOfDay
      : new Date().getHours();

  return {
    amount: txn.amount,
    is_international: txn.isInternational ? 1 : 0,
    hour_of_day: hour,
    region_code: encodeRegion(txn.region),
    location_code: encodeLocation(txn.location),
    target_bank_code: encodeBank(txn.targetBank),
  };
}

export function featuresToArray(
  f: FeatureVector,
  keys: (keyof FeatureVector)[]
): number[] {
  return keys.map((k) => f[k]);
}
