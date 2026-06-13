export type OrderRecord = {
  id: string;
  sourceName: string | null;
  appId: string | null;
  userAgent: string | null;
  browserIp: string | null;
  referringSite: string | null;
  landingSite: string | null;
  totalPrice: number;
  createdAt: string; // ISO 8601
  financialStatus: string | null;
};

export type DisputeRecord = {
  orderId: string;
  status: string;
  type: string | null;
  amount: number | null;
  initiatedAt: string | null;
};

export type OrderClass =
  | "confirmed_channel"
  | "high_confidence_agent"
  | "heuristic_agent"
  | "human";

export type Classification = { orderClass: OrderClass; signals: string[] };

export type ClassSummary = {
  orders: number;
  orderShare: number;
  gmv: number;
  gmvShare: number;
  aov: number;
  disputes: number;
  disputeRate: number;
};

export type MonthBucket = {
  month: string; // "YYYY-MM"
  orders: number;
  agentOrders: number;
  agentOrderShare: number;
  gmv: number;
  agentGmv: number;
  agentGmvShare: number;
};

export type VampConfig = { aboveStandard: number; excessive: number }; // ratios: 0.005, 0.015

export type ClassifyOutput = {
  store: string;
  generatedAt: string;
  windowDays: number;
  totals: { orders: number; gmv: number; disputes: number; disputeRate: number };
  byClass: Record<OrderClass, ClassSummary>;
  distinctSources: {
    sourceName: string;
    appId: string | null;
    orders: number;
    flaggedAssistant: boolean;
  }[];
  agentVsHuman: {
    agentOrders: number;
    agentGmv: number;
    humanGmv: number;
    agentAov: number;
    humanAov: number;
    agentDisputeRate: number;
    humanDisputeRate: number;
    delta: number;
  };
  monthlyTrend: MonthBucket[];
  vamp: {
    config: VampConfig;
    combinedRatio: number;
    band: "ok" | "above_standard" | "excessive";
    headroomToNextBand: number | null;
  };
};
