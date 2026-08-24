import { describe, expect, it } from "vitest";
import {
  beginProductAvailabilityRequest,
  finishProductAvailabilityRequest,
} from "../product-availability";

describe("product availability in-flight guard", () => {
  it("blocks duplicate requests synchronously and releases the product after settle", () => {
    const inFlight = new Set<number>();

    expect(beginProductAvailabilityRequest(inFlight, 3)).toBe(true);
    expect(beginProductAvailabilityRequest(inFlight, 3)).toBe(false);
    expect(beginProductAvailabilityRequest(inFlight, 4)).toBe(true);

    finishProductAvailabilityRequest(inFlight, 3);
    expect(beginProductAvailabilityRequest(inFlight, 3)).toBe(true);
  });
});
