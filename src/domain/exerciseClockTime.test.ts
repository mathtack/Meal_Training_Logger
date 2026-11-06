import { expect, it } from "vitest";
import { exerciseClockTime } from "./exerciseClockTime";

it("displays stored instants and old wall clocks consistently in JST", () => {
  expect(exerciseClockTime("2026-11-05T15:25:00+00:00")).toBe("00:25");
  expect(exerciseClockTime("2026-11-06T00:25:00+09:00")).toBe("00:25");
  expect(exerciseClockTime("2026-11-06T00:25:00")).toBe("00:25");
  expect(exerciseClockTime("not-a-timestamp")).toBeNull();
});
