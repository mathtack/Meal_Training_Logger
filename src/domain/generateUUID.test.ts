import { afterEach, describe, expect, it, vi } from "vitest";
import { generateUUID } from "./generateUUID";

describe("generateUUID", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the platform randomUUID implementation", () => {
    const randomUUID = vi
      .fn()
      .mockReturnValue("00000000-0000-4000-8000-000000000001");
    vi.stubGlobal("crypto", { randomUUID });

    expect(generateUUID()).toBe("00000000-0000-4000-8000-000000000001");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("fails explicitly when secure UUID generation is unavailable", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() => generateUUID()).toThrow(
      "crypto.randomUUID() is required to create record IDs.",
    );
  });
});
