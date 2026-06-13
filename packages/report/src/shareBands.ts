import type { ClassifyOutput } from "@agentaudit/audit";

// Pre-empts the skeptic's "your agent % counts VPN users" attack by presenting a
// floor (strong signals only) and a ceiling (heuristic-inclusive), not one number.
export type ShareBand = {
  floorOrderShare: number; // confirmed-assistant + high-confidence
  ceilingOrderShare: number; // + heuristic tier
  floorGmvShare: number;
  ceilingGmvShare: number;
  floorOrders: number;
  ceilingOrders: number;
};

export function agentShareBand(c: ClassifyOutput): ShareBand {
  const totalOrders = c.totals.orders || 1;
  const totalGmv = c.totals.gmv || 1;
  const ceilingOrders = c.agentVsHuman.agentOrders;
  const floorOrders = Math.max(ceilingOrders - c.byClass.heuristic_agent.orders, 0);
  const ceilingGmv = c.agentVsHuman.agentGmv;
  const floorGmv = Math.max(ceilingGmv - c.byClass.heuristic_agent.gmv, 0);
  return {
    floorOrders,
    ceilingOrders,
    floorOrderShare: floorOrders / totalOrders,
    ceilingOrderShare: ceilingOrders / totalOrders,
    floorGmvShare: floorGmv / totalGmv,
    ceilingGmvShare: ceilingGmv / totalGmv,
  };
}
