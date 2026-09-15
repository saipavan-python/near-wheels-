import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../password";

describe("password hashing", () => {
  it("hashes with a unique salt and verifies the correct password", () => {
    const stored = hashPassword("CorrectHorse5");
    expect(stored).toContain(":");
    expect(verifyPassword("CorrectHorse5", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("CorrectHorse5");
    expect(verifyPassword("wrongpass1", stored)).toBe(false);
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("CorrectHorse5", "notahash")).toBe(false);
    expect(verifyPassword("CorrectHorse5", "")).toBe(false);
  });

  it("produces different hashes for the same password (random salt)", () => {
    expect(hashPassword("CorrectHorse5")).not.toBe(hashPassword("CorrectHorse5"));
  });
});

describe("validatePasswordStrength", () => {
  it("accepts a strong password", () => {
    expect(validatePasswordStrength("StrongPass1")).toBeNull();
  });

  it("requires length >= 8", () => {
    expect(validatePasswordStrength("Aa1")).not.toBeNull();
  });

  it("requires upper, lower and digit", () => {
    expect(validatePasswordStrength("aaaaaaaa1")).not.toBeNull();
    expect(validatePasswordStrength("AAAAAAAA1")).not.toBeNull();
    expect(validatePasswordStrength("AaAaAaAaAa")).not.toBeNull();
  });
});