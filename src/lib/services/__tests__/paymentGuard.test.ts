import { describe, it, expect } from "vitest";
import { paymentSettled, expectedAmountPaise, roundMoney } from "../paymentGuard";

describe("paymentSettled", () => {
  it("treats a successful payment as settled", () => {
    expect(paymentSettled("SUCCESS", "PENDING")).toBe(true);
    expect(paymentSettled("SUCCESS", "PAID")).toBe(true);
  });

  it("treats a refunded payment as settled", () => {
    expect(paymentSettled("REFUNDED", "PENDING")).toBe(true);
  });

  it("treats a PAID booking as settled even if the payment row lags", () => {
    expect(paymentSettled("PENDING", "PAID")).toBe(true);
    expect(paymentSettled("FAILED", "PAID")).toBe(true);
  });

  it("is not settled while pending/unpaid", () => {
    expect(paymentSettled("PENDING", "UNPAID")).toBe(false);
    expect(paymentSettled("FAILED", "UNPAID")).toBe(false);
    expect(paymentSettled("CREATED", "PENDING")).toBe(false);
  });
});

describe("expectedAmountPaise", () => {
  it("converts INR totals to paise", () => {
    expect(expectedAmountPaise(1500)).toBe(150000);
    expect(expectedAmountPaise(1500.5)).toBe(150050);
  });
});

describe("roundMoney", () => {
  it("rounds to paise", () => {
    expect(roundMoney(100.005)).toBe(100.01);
    expect(roundMoney(100)).toBe(100);
  });
});