import { afterEach, describe, expect, it } from "vitest";
import { getUser, setUser } from "../api";

describe("admin session user source", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("reads the Super Admin role from the canonical admin_user session", () => {
    setUser({
      id: 1,
      fullname: "Super Administrator",
      phone: "0900000000",
      role: "super",
      branch_id: null,
    });

    expect(getUser()?.role).toBe("super");
  });

  it("does not read the obsolete auth_user key as an admin session", () => {
    localStorage.setItem("auth_user", JSON.stringify({ role: "super" }));

    expect(getUser()).toBeNull();
  });

  it("keeps non-super admin roles distinct", () => {
    setUser({
      id: 2,
      fullname: "Store Manager",
      phone: "0900000001",
      role: "manager",
      branch_id: 1,
    });

    expect(getUser()?.role).toBe("manager");
  });
});
