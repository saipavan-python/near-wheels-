import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../rateLimit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit", () => {
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit(`t:allow-${i}`, 3, 60_000);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it("blocks once the limit is reached", () => {
    const key = "t:block";
    for (let i = 0; i < 2; i++) checkRateLimit(key, 2, 60_000);
    const r = checkRateLimit(key, 2, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it("is independent per key", () => {
    for (let i = 0; i < 2; i++) checkRateLimit("t:k1", 2, 60_000);
    expect(checkRateLimit("t:k2", 2, 60_000).allowed).toBe(true);
  });

  it("expires tokens after the window", async () => {
    const key = "t:window";
    expect(checkRateLimit(key, 1, 1).allowed).toBe(true); // limit 1 with 1ms window
    await new Promise((r) => setTimeout(r, 10));           // let the token expire
    expect(checkRateLimit(key, 1, 1).allowed).toBe(true);  // expired → allowed again
  });
});