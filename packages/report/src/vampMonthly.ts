import type { ClassifyOutput, MonthBucket, VampConfig } from "@agentaudit/audit";

export type VampBand = "ok" | "above_standard" | "excessive";

export type MonthVamp = {
  month: string;
  orders: number;
  disputes: number;
  ratio: number | null; // null when below the min-n threshold (count shown instead)
  band: VampBand | null;
  suppressed: boolean;
};

export type MonthlyVamp = {
  minOrders: number;
  months: MonthVamp[];
  worstQualifying: MonthVamp | null; // worst month that cleared the min-n bar
  qualifyingMonths: number;
};

// VAMP is assessed monthly. A blended 90-day ratio either hides a bad month or,
// on a low-volume store, manufactures an alarming number. We compute per month
// but SUPPRESS the ratio for any month below `minOrders` so a 2-order month can
// never render "50%". The worst month is chosen only among qualifying months.
export function monthlyVamp(
  trend: MonthBucket[],
  config: VampConfig,
  minOrders = 200,
): MonthlyVamp {
  const band = (ratio: number): VampBand =>
    ratio >= config.excessive ? "excessive" : ratio >= config.aboveStandard ? "above_standard" : "ok";

  const months: MonthVamp[] = trend.map((m) => {
    const qualifies = m.orders >= minOrders;
    const ratio = qualifies ? m.disputes / m.orders : null;
    return {
      month: m.month,
      orders: m.orders,
      disputes: m.disputes,
      ratio,
      band: ratio === null ? null : band(ratio),
      suppressed: !qualifies,
    };
  });

  const qualifying = months.filter((m) => m.ratio !== null);
  const worstQualifying =
    qualifying.length === 0
      ? null
      : qualifying.reduce((worst, m) => (m.ratio! > worst.ratio! ? m : worst));

  return { minOrders, months, worstQualifying, qualifyingMonths: qualifying.length };
}

export function vampHeadline(classify: ClassifyOutput, mv: MonthlyVamp): string {
  if (mv.worstQualifying === null) {
    return `Order volume is too low to compute a reliable monthly dispute ratio (need >=${mv.minOrders} orders/month); ${classify.totals.disputes} disputes across ${classify.totals.orders} orders in the window.`;
  }
  const w = mv.worstQualifying;
  const bandLabel =
    w.band === "ok" ? "within Visa's monitoring thresholds" : w.band === "above_standard" ? "above Visa's standard threshold" : "in Visa's excessive band";
  return `Worst qualifying month (${w.month}): ${w.disputes} disputes / ${w.orders} orders = ${(w.ratio! * 100).toFixed(2)}% — ${bandLabel}.`;
}
