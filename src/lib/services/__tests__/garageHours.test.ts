import { describe, it, expect } from "vitest";
import { garageStatus, minutesOf, hasEmergencyServices, fmtTime } from "../garageHours";

const active = { status: "ACTIVE", availabilityStatus: "AVAILABLE_NOW" };

function at(h: number, m = 0): Date {
  const d = new Date(2026, 0, 15); // a Thursday
  d.setHours(h, m, 0, 0);
  return d;
}

describe("minutesOf", () => {
  it("parses HH:MM", () => {
    expect(minutesOf("08:00")).toBe(480);
    expect(minutesOf("21:30")).toBe(1290);
    expect(minutesOf("00:05")).toBe(5);
  });
  it("returns null for invalid/blank", () => {
    expect(minutesOf("")).toBeNull();
    expect(minutesOf(null)).toBeNull();
    expect(minutesOf("25:00")).toBeNull();
    expect(minutesOf("9")).toBeNull();
  });
});

describe("fmtTime", () => {
  it("formats 12h clock", () => {
    expect(fmtTime(480)).toBe("8:00 AM");
    expect(fmtTime(1290)).toBe("9:30 PM");
    expect(fmtTime(0)).toBe("12:00 AM");
    expect(fmtTime(720)).toBe("12:00 PM");
  });
});

describe("hasEmergencyServices", () => {
  it("detects emergency + classic roadside tokens", () => {
    expect(hasEmergencyServices(["EMERGENCY", "MECHANIC"])).toBe(true);
    expect(hasEmergencyServices(["BREAKDOWN"])).toBe(true);
    expect(hasEmergencyServices(["AC_REPAIR", "WATER_SERVICE"])).toBe(false);
  });
});

describe("garageStatus · 24×7", () => {
  it("always open when 24×7, even at 3am", () => {
    const s = garageStatus({ open24x7: true, services: '["MECHANIC","EMERGENCY"]' }, active, at(3));
    expect(s.open).toBe(true);
    expect(s.label).toBe("24×7");
    expect(s.emergency).toBe(true);
  });
  it("respects manual offline opt-out", () => {
    const s = garageStatus({ open24x7: true }, { status: "ACTIVE", availabilityStatus: "OFFLINE" }, at(3));
    expect(s.open).toBe(false);
  });
});

describe("garageStatus · normal window", () => {
  const profile = { open24x7: false, opensAt: "08:00", closesAt: "21:00" };
  it("open inside window", () => {
    const s = garageStatus(profile, active, at(12));
    expect(s.open).toBe(true);
    expect(s.label).toBe("Open now");
    expect(s.detail).toBe("Closes at 9:00 PM");
  });
  it("closed before opening", () => {
    const s = garageStatus(profile, active, at(7));
    expect(s.open).toBe(false);
    expect(s.detail).toBe("Opens at 8:00 AM today");
  });
  it("closed after closing", () => {
    const s = garageStatus(profile, active, at(22));
    expect(s.open).toBe(false);
    expect(s.detail).toBe("Opens at 8:00 AM tomorrow");
  });
  it("closed at boundary (22:00 vs closes 21:00)", () => {
    expect(garageStatus(profile, active, at(21, 0)).open).toBe(false);
  });
});

describe("garageStatus · overnight window", () => {
  const profile = { open24x7: false, opensAt: "22:00", closesAt: "06:00" };
  it("open late night", () => {
    const s = garageStatus(profile, active, at(23, 30));
    expect(s.open).toBe(true);
  });
  it("open early morning", () => {
    expect(garageStatus(profile, active, at(5, 0)).open).toBe(true);
  });
  it("closed mid-day", () => {
    expect(garageStatus(profile, active, at(12, 0)).open).toBe(false);
  });
});

describe("garageStatus · no hours configured", () => {
  it("open only when provider marked AVAILABLE_NOW", () => {
    expect(garageStatus({ services: ["MECHANIC"] }, active, at(12)).open).toBe(true);
    expect(
      garageStatus({ services: ["MECHANIC"] }, { status: "ACTIVE", availabilityStatus: "OFFLINE" }, at(12)).open
    ).toBe(false);
  });
});