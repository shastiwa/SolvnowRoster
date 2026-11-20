import { describe, it, expect } from "vitest";
import { AuthorizationService } from "@/server/authorization/service";
import { AuthorizationError } from "@/lib/errors";
import { SessionUser } from "@/server/auth/session";
import { Role } from "@prisma/client";

describe("Authorization Service (RBAC)", () => {
  const adminUser: SessionUser = {
    id: "usr-admin",
    loginName: "admin",
    displayName: "Admin",
    email: "admin@solvnow.internal",
    role: Role.ROSTER_ADMIN,
    managedGroupIds: [],
  };

  const managerUser: SessionUser = {
    id: "usr-manager",
    loginName: "manager",
    displayName: "Manager",
    email: "manager@solvnow.internal",
    role: Role.ROSTER_MANAGER,
    managedGroupIds: ["sg-1"],
  };

  const standardUser: SessionUser = {
    id: "usr-user",
    loginName: "user",
    displayName: "User",
    email: "user@solvnow.internal",
    role: Role.ROSTER_USER,
    managedGroupIds: [],
  };

  describe("assertAdmin", () => {
    it("allows ROSTER_ADMIN", () => {
      expect(() => AuthorizationService.assertAdmin(adminUser)).not.toThrow();
    });

    it("rejects ROSTER_MANAGER", () => {
      expect(() => AuthorizationService.assertAdmin(managerUser)).toThrow(
        AuthorizationError
      );
    });

    it("rejects ROSTER_USER", () => {
      expect(() => AuthorizationService.assertAdmin(standardUser)).toThrow(
        AuthorizationError
      );
    });
  });

  describe("assertCanExecuteSync", () => {
    it("allows ROSTER_ADMIN to sync", () => {
      expect(() =>
        AuthorizationService.assertCanExecuteSync(adminUser)
      ).not.toThrow();
    });

    it("rejects ROSTER_MANAGER from executing sync", () => {
      expect(() =>
        AuthorizationService.assertCanExecuteSync(managerUser)
      ).toThrow(AuthorizationError);
    });

    it("rejects ROSTER_USER from executing sync", () => {
      expect(() =>
        AuthorizationService.assertCanExecuteSync(standardUser)
      ).toThrow(AuthorizationError);
    });
  });

  describe("assertCanManageSupportGroup", () => {
    it("allows ROSTER_ADMIN for any group", () => {
      expect(() =>
        AuthorizationService.assertCanManageSupportGroup(adminUser, "any-group-id")
      ).not.toThrow();
    });

    it("allows ROSTER_MANAGER for assigned group", () => {
      expect(() =>
        AuthorizationService.assertCanManageSupportGroup(managerUser, "sg-1")
      ).not.toThrow();
    });

    it("rejects ROSTER_MANAGER for unassigned group", () => {
      expect(() =>
        AuthorizationService.assertCanManageSupportGroup(managerUser, "sg-unassigned")
      ).toThrow(AuthorizationError);
    });

    it("rejects ROSTER_USER for any group", () => {
      expect(() =>
        AuthorizationService.assertCanManageSupportGroup(standardUser, "sg-1")
      ).toThrow(AuthorizationError);
    });
  });
});
