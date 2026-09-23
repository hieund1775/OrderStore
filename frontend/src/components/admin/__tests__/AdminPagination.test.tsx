import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPagination } from "../AdminPagination";

const reactTestGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };

describe("AdminPagination", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container.remove();
    reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders correct page text and disables 'Trang trước' on first page", async () => {
    const handlePageChange = vi.fn();

    await act(async () => {
      root?.render(
        <AdminPagination
          page={1}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );
    });

    expect(container.textContent).toContain("Trang 1 / 5");

    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);

    const prevButton = buttons[0];
    const nextButton = buttons[1];

    expect(prevButton.textContent).toContain("Trang trước");
    expect(prevButton.disabled).toBe(true);

    expect(nextButton.textContent).toContain("Trang sau");
    expect(nextButton.disabled).toBe(false);

    await act(async () => {
      nextButton.click();
    });

    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it("disables 'Trang sau' on last page and triggers 'Trang trước'", async () => {
    const handlePageChange = vi.fn();

    await act(async () => {
      root?.render(
        <AdminPagination
          page={5}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );
    });

    expect(container.textContent).toContain("Trang 5 / 5");

    const buttons = container.querySelectorAll("button");
    const prevButton = buttons[0];
    const nextButton = buttons[1];

    expect(prevButton.disabled).toBe(false);
    expect(nextButton.disabled).toBe(true);

    await act(async () => {
      prevButton.click();
    });

    expect(handlePageChange).toHaveBeenCalledWith(4);
  });

  it("renders total items and item label when provided", async () => {
    await act(async () => {
      root?.render(
        <AdminPagination
          page={2}
          totalPages={4}
          totalItems={78}
          itemLabel="sản phẩm"
          onPageChange={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Trang 2 / 4");
    expect(container.textContent).toContain("(78 sản phẩm)");
  });

  it("disables both buttons when loading is true", async () => {
    await act(async () => {
      root?.render(
        <AdminPagination
          page={2}
          totalPages={4}
          loading={true}
          onPageChange={vi.fn()}
        />
      );
    });

    const buttons = container.querySelectorAll("button");
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });
});
