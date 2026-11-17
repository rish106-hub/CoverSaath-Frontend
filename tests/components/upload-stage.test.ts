import { describe, expect, it } from "vitest";
import { stageOf } from "@/adapters/covers";

const steps = (scanned: string, reading: string, structured: string) => ({ steps: { uploaded: "done", scanned, reading, structured } as never });

describe("upload stage follows the backend document steps", () => {
  it("maps each step to the stage the page shows", () => {
    expect(stageOf(steps("pending", "pending", "pending"))).toBe("checking");
    expect(stageOf(steps("done", "active", "pending"))).toBe("reading");
    expect(stageOf(steps("done", "done", "active"))).toBe("details");
    expect(stageOf(steps("done", "done", "done"))).toBe("details");
  });
});
