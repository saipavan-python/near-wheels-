import { describe, expect, it } from "vitest";
import { retrieveKnowledge } from "../knowledgeBase";

describe("retrieveKnowledge", () => {
  it("answers cancellation questions", () => {
    const hit = retrieveKnowledge("how do I cancel my booking?");
    expect(hit?.entry.id).toBe("cancellation");
    expect(hit!.entry.answer).toMatch(/10%/);
  });

  it("answers refund questions", () => {
    const hit = retrieveKnowledge("will I get my money back if I cancel?");
    expect(hit?.entry.id).toBe("cancellation");
  });

  it("answers insurance questions", () => {
    const hit = retrieveKnowledge("is insurance included with the car?");
    expect(hit?.entry.id).toBe("insurance");
  });

  it("answers how-to-book questions", () => {
    const hit = retrieveKnowledge("how booking works?");
    expect(hit?.entry.id).toBe("booking_steps");
  });

  it("answers garage-hours questions even without a location", () => {
    const hit = retrieveKnowledge("which garages are open right now?");
    expect(hit?.entry.id).toBe("garage_hours");
  });

  it("answers payment questions", () => {
    const hit = retrieveKnowledge("can I pay online by UPI card?");
    expect(hit?.entry.id).toBe("how_paid");
  });

  it("answers farm service questions", () => {
    const hit = retrieveKnowledge("tractor per acre how much?");
    expect(hit?.entry.id).toBe("farm_help");
  });

  it("answers budget trip questions", () => {
    const hit = retrieveKnowledge("how does the budget trip plan work?");
    expect(hit?.entry.id).toBe("trip_budget");
  });

  it("handles greeting / capabilities", () => {
    const hit = retrieveKnowledge("what can you do?");
    expect(hit?.entry.id).toBe("capabilities");
  });

  it("returns null for gibberish", () => {
    expect(retrieveKnowledge("zxcvb qwerty mnop")).toBeNull();
  });

  it("handles loosly-spelled telugu-ish text via keywords", () => {
    const hit = retrieveKnowledge("naa booking cancel cheyali");
    expect(hit?.entry.id).toBe("cancellation");
  });
});