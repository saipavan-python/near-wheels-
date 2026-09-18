import { describe, expect, it } from "vitest";
import { dedupeScoredLocations } from "../locationService";
import type { Location } from "@prisma/client";

function loc(id: string, name: string, lat: number, lng: number, popular = false): Location {
  return { id, name, type: "TOWN", lat, lng, aliases: "[]", popular, district: null, state: null };
}

describe("dedupeScoredLocations", () => {
  it("collapses duplicate rows for the same city at the same point", () => {
    const scored = [
      { loc: loc("a", "Nandyal", 15.4771, 78.4807), score: 1.0 },
      { loc: loc("b", "Nandyal", 15.4771, 78.4807), score: 1.0 },
    ];
    const out = dedupeScoredLocations(scored);
    expect(out).toHaveLength(1);
    expect(out[0].loc.id).toBe("a");
  });

  it("keeps distinct places even when the names are identical", () => {
    const scored = [
      { loc: loc("a", "Nandyal", 15.4771, 78.4807), score: 1.0 },
      { loc: loc("b", "Nandyal", 17.6, 79.1), score: 1.0 },
    ];
    expect(dedupeScoredLocations(scored)).toHaveLength(2);
  });

  it("keeps same-name landmarks at different points separate", () => {
    const scored = [
      { loc: loc("a", "Nandyal Railway Station", 15.4805, 78.4745), score: 0.9 },
      { loc: loc("b", "Nandyal Railway Station", 15.4805, 78.4745), score: 0.9 },
      { loc: loc("c", "Nandyal", 15.4771, 78.4807), score: 1.0 },
    ];
    const out = dedupeScoredLocations(scored);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.loc.name).sort()).toEqual(["Nandyal", "Nandyal Railway Station"]);
  });

  it("keeps the higher-scoring duplicate", () => {
    const scored = [
      { loc: loc("low", "Nandyal", 15.4771, 78.4807), score: 0.7 },
      { loc: loc("high", "Nandyal", 15.4771, 78.4807), score: 1.0 },
    ];
    expect(dedupeScoredLocations(scored)[0].loc.id).toBe("high");
  });

  it("sorts results best first", () => {
    const out = dedupeScoredLocations([
      { loc: loc("a", "A", 1, 1), score: 0.8 },
      { loc: loc("b", "B", 2, 2), score: 1.0 },
    ]);
    expect(out.map((s) => s.loc.name)).toEqual(["B", "A"]);
  });
});