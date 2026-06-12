import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDisputesCsv, parseOrdersCsv } from "../../src/classify/csv.js";

const ordersCsv = readFileSync(new URL("../fixtures/orders.csv", import.meta.url), "utf8");
const disputesCsv = readFileSync(new URL("../fixtures/disputes.csv", import.meta.url), "utf8");

describe("parseOrdersCsv", () => {
  it("parses the fixture into OrderRecords", () => {
    const orders = parseOrdersCsv(ordersCsv);
    expect(orders).toHaveLength(40);
    const first = orders[0]!;
    expect(first.id).toBe("1001");
    expect(first.sourceName).toBe("chatgpt");
    expect(typeof first.totalPrice).toBe("number");
  });

  it("maps empty strings to null", () => {
    const orders = parseOrdersCsv(ordersCsv);
    const noRef = orders.find((o) => o.referringSite === null);
    expect(noRef).toBeDefined();
  });

  it("throws a helpful error when the id column is missing", () => {
    expect(() => parseOrdersCsv("source_name,total_price\nweb,10\n")).toThrow(
      /missing required column: id/,
    );
  });

  it("throws on a non-numeric price", () => {
    expect(() => parseOrdersCsv("id,total_price\n1,abc\n")).toThrow(/not a number/);
  });
});

describe("parseDisputesCsv", () => {
  it("parses the fixture into DisputeRecords", () => {
    const disputes = parseDisputesCsv(disputesCsv);
    expect(disputes).toHaveLength(3);
    expect(disputes[0]!.orderId).toBe("1003");
    expect(disputes[0]!.amount).toBe(89);
  });

  it("throws when order_id column is missing", () => {
    expect(() => parseDisputesCsv("status\nopen\n")).toThrow(/missing required column: order_id/);
  });
});
