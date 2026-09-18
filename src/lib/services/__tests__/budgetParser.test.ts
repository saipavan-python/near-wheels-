import { describe, expect, it } from "vitest";
import { parseTripIntent } from "../budgetParser";

describe("parseTripIntent", () => {
  it("parses the classic budget trip", () => {
    const i = parseTripIntent("₹10000 Guntur to Tirupati 5 members Ertiga + driver");
    expect(i.budget).toBe(10000);
    expect(i.from).toBe("Guntur");
    expect(i.to).toBe("Tirupati");
    expect(i.pax).toBe(5);
    expect(i.vehicleModel).toBe("ertiga");
    expect(i.withDriver).toBe(true);
  });

  it("parses arrow routes", () => {
    const i = parseTripIntent("Guntur -> Tirupati 2 people");
    expect(i.from).toBe("Guntur");
    expect(i.to).toBe("Tirupati");
    expect(i.pax).toBe(2);
  });

  it("parses Telugu dative single destination", () => {
    expect(parseTripIntent("Guntur ki").to).toBe("Guntur");
    expect(parseTripIntent("to Guntur").to).toBe("Guntur");
  });

  it("does NOT see 'ki' inside an English word as a location separator", () => {
    const i = parseTripIntent("how do I cancel my booking?");
    expect(i.to).toBeUndefined();
    expect(i.from).toBeUndefined();
  });

  it("does not hallucinate locations from plain questions", () => {
    const i = parseTripIntent("is insurance included with the car?");
    expect(i.to).toBeUndefined();
    expect(i.from).toBeUndefined();
  });

  it("parses telugu from/to", () => {
    const i = parseTripIntent("Guntur నుంచి Tirupati వెళ్లాలి");
    expect(i.from).toBe("Guntur");
    expect(i.to).toBe("Tirupati");
  });
});