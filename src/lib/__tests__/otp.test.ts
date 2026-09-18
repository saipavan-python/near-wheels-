import { describe, it, expect } from "vitest";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "../otp";

describe("generateOtpCode", () => {
  it("returns a 6-digit numeric code by default", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("supports custom lengths", () => {
    expect(generateOtpCode(4)).toMatch(/^\d{4}$/);
  });

  it("produces varying codes", () => {
    const a = new Set();
    for (let i = 0; i < 50; i++) a.add(generateOtpCode());
    expect(a.size).toBeGreaterThan(1);
  });
});

describe("hashOtpCode / verifyOtpCode", () => {
  it("verifies a hashed code", () => {
    const code = "123456";
    expect(verifyOtpCode(hashOtpCode(code), code)).toBe(true);
  });

  it("rejects a wrong code", () => {
    expect(verifyOtpCode(hashOtpCode("123456"), "654321")).toBe(false);
  });

  it("does not store the code in plaintext", () => {
    expect(hashOtpCode("123456")).not.toContain("123456");
    expect(hashOtpCode("123456")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies legacy plaintext 6-digit codes", () => {
    expect(verifyOtpCode("123456", "123456")).toBe(true);
    expect(verifyOtpCode("123456", "654321")).toBe(false);
  });

  it("handles missing or malformed input", () => {
    expect(verifyOtpCode(null, "123456")).toBe(false);
    expect(verifyOtpCode(undefined, "123456")).toBe(false);
    expect(verifyOtpCode("", "123456")).toBe(false);
  });
});