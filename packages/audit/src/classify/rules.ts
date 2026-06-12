import {
  hasAssistantUtmSource,
  hasHeadlessMarker,
  isAssistantReferrer,
  isAssistantSourceName,
  matchesAgentUa,
} from "./agents.js";
import { ipInAnyCidr } from "./cidr.js";
import type { Classification, OrderRecord } from "./types.js";

const STANDARD_SOURCE_NAMES = new Set(["web", "pos", "shopify_draft_order", "draft"]);
// Shopify first-party surfaces: 580111 online store, 129785 POS, 1354745 draft orders
const STANDARD_APP_IDS = new Set(["580111", "129785", "1354745"]);

export function classifyOrder(
  order: OrderRecord,
  datacenterCidrs: readonly string[],
): Classification {
  const signals: string[] = [];

  const source = order.sourceName?.trim().toLowerCase() ?? "";
  const nonStandardSource = source !== "" && !STANDARD_SOURCE_NAMES.has(source);
  const nonStandardApp = order.appId !== null && !STANDARD_APP_IDS.has(order.appId);
  if (nonStandardSource || nonStandardApp) {
    if (nonStandardSource) signals.push(`source_name:${source}`);
    if (nonStandardApp) signals.push(`app_id:${order.appId}`);
    if (isAssistantSourceName(source)) signals.push("assistant_channel");
    return { orderClass: "confirmed_channel", signals };
  }

  const uaToken = matchesAgentUa(order.userAgent);
  if (uaToken) signals.push(`ua:${uaToken}`);
  if (isAssistantReferrer(order.referringSite)) signals.push(`referrer:${order.referringSite}`);
  if (hasAssistantUtmSource(order.landingSite)) signals.push(`utm_source:${order.landingSite}`);
  if (signals.length > 0) return { orderClass: "high_confidence_agent", signals };

  if (hasHeadlessMarker(order.userAgent)) {
    return { orderClass: "heuristic_agent", signals: [`ua_headless:${order.userAgent}`] };
  }
  if (order.browserIp && ipInAnyCidr(order.browserIp, datacenterCidrs)) {
    return { orderClass: "heuristic_agent", signals: [`ip_datacenter:${order.browserIp}`] };
  }

  return { orderClass: "human", signals: [] };
}
