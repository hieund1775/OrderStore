import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { CustomerDateTime } from "../../components/time/CustomerDateTime";

const instant = "2026-08-24T17:05:00.000Z";
const reactTestGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };

describe("CustomerDateTime component", () => {
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
    reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    container.remove();
    vi.restoreAllMocks();
    reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders stable Vietnam store time during SSR", () => {
    const html = renderToString(<CustomerDateTime value={instant} />);
    expect(html).toContain("00:05 - 25/08/2026");
    expect(html).not.toContain("Giờ cửa hàng:");
  });

  it("hydrates without mismatch and then shows Tokyo time plus store time", async () => {
    const element = <CustomerDateTime value={instant} forcedClientTimeZone="Asia/Tokyo" />;
    container.innerHTML = renderToString(element);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await act(async () => {
      root = hydrateRoot(container, element);
    });

    expect(container.textContent).toContain("02:05 - 25/08/2026");
    expect(container.textContent).toContain("Giờ cửa hàng: 00:05 - 25/08/2026 GMT+7");
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydration|did not match/i);
  });

  it("treats Asia/Saigon as Vietnam and does not display duplicate times", async () => {
    const element = <CustomerDateTime value={instant} forcedClientTimeZone="Asia/Saigon" />;
    container.innerHTML = renderToString(element);

    await act(async () => {
      root = hydrateRoot(container, element);
    });

    expect(container.textContent).toBe("00:05 - 25/08/2026");
    expect(container.textContent).not.toContain("Giờ cửa hàng:");
  });

  it("falls back to store time for an invalid browser timezone", async () => {
    const element = <CustomerDateTime value={instant} forcedClientTimeZone="Invalid/Zone" />;
    container.innerHTML = renderToString(element);

    await act(async () => {
      root = hydrateRoot(container, element);
    });

    expect(container.textContent).toBe("00:05 - 25/08/2026");
  });

  it("renders a dash for an invalid timestamp", () => {
    const html = renderToString(<CustomerDateTime value="invalid-timestamp" />);
    expect(html).toContain("—");
  });
});
