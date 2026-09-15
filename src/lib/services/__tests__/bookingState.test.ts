import { describe, it, expect } from "vitest";
import { canTransition, InvalidTransitionError } from "../bookingState";

describe("booking state machine", () => {
  it("allows valid transitions", () => {
    expect(canTransition("PENDING", "ACCEPTED")).toBe(true);
    expect(canTransition("ACCEPTED", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransition("REQUESTED", "PENDING_PROVIDER")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("COMPLETED", "PENDING")).toBe(false);
    expect(canTransition("REJECTED", "ACCEPTED")).toBe(false);
    expect(canTransition("PENDING", "IN_PROGRESS")).toBe(false);
  });

  it("rejects unknown states", () => {
    expect(canTransition("NOT_A_STATE", "ACCEPTED")).toBe(false);
  });

  it("has a usable InvalidTransitionError marker", () => {
    const e = new InvalidTransitionError("Cannot go PENDING → COMPLETED");
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toContain("PENDING");
  });
});