import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "../session";

describe("signed sessions", () => {
  it("round-trips a valid customer session", () => {
    const token = createSessionToken({ userId: "user_123", role: "CUSTOMER", name: "Pawan" });
    expect(verifySessionToken(token)).toMatchObject({ userId: "user_123", role: "CUSTOMER", name: "Pawan" });
  });

  it("rejects altered, malformed, and oversized tokens", () => {
    const token = createSessionToken({ userId: "user_123", role: "CUSTOMER" });
    const [body, signature] = token.split(".");
    expect(verifySessionToken(`${body}.${signature.slice(1)}`)).toBeNull();
    expect(verifySessionToken(`${token}.extra`)).toBeNull();
    expect(verifySessionToken("not-a-session")).toBeNull();
    expect(verifySessionToken("a".repeat(4097))).toBeNull();
  });

  it("rejects unsupported roles in otherwise signed payloads", () => {
    const token = createSessionToken({ userId: "user_123", role: "ROOT" });
    expect(verifySessionToken(token)).toBeNull();
  });
});
