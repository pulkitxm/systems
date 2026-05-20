export type TxnStatus =
  | "INITIATED"
  | "BLOCKED"
  | "FRAUD"
  | "ALLOWED"
  | "DONE"
  | "FAILED";

export interface Transaction {
  txnId: string;
  sourceAcc: string;
  targetAcc: string;
  amount: number;
  status: TxnStatus;
  ip: string;
  region: string;
  location: string;
  targetBank: string;
  isInternational: boolean;
  hourOfDay: number;
  createdAt: number;
}

export interface CustomerSupportTicket {
  ticketId: string;
  txnId: string;
  isFraud: boolean;
  summary: string;
  resolvedAt: number;
}

export interface TransactionRequest {
  sourceAcc: string;
  targetAcc: string;
  amount: number;
  ip: string;
  region: string;
  location: string;
  targetBank: string;
  isInternational: boolean;
  hourOfDay?: number;
}

export interface FeatureVector {
  amount: number;
  is_international: number;
  hour_of_day: number;
  region_code: number;
  location_code: number;
  target_bank_code: number;
}

export interface TrainingSample {
  features: FeatureVector;
  label: 0 | 1; // 0 = legit, 1 = fraud
  txnId: string;
}

export interface TreeNode {
  type: "leaf" | "split";
  label?: 0 | 1;
  feature?: keyof FeatureVector;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

export interface SerializedTree {
  name: string;
  features: (keyof FeatureVector)[];
  root: TreeNode;
}

export interface SerializedForest {
  version: number;
  trainedAt: number;
  trees: SerializedTree[];
}

export interface FraudClassification {
  isFraud: boolean;
  confidence: number;
  treeVotes: { tree: string; vote: 0 | 1 }[];
  latencyMs: number;
}

export interface TransactionResult {
  txnId: string;
  status: TxnStatus;
  fraudCheck: FraudClassification;
  message: string;
}
