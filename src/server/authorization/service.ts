import { Role } from "@prisma/client";
import { SessionUser } from "../auth/session";
import { AuthorizationError } from "@/lib/errors";

export class AuthorizationService {
  /**
   * Asserts that the user is an admin or is an authorized manager for the specified support group.
   */
  public static assertCanManageSupportGroup(
    user: SessionUser,
    supportGroupId: string
  ): void {
    if (user.role === Role.ROSTER_ADMIN) {
      return;
    }

    if (user.role === Role.ROSTER_MANAGER) {
      if (user.managedGroupIds.includes(supportGroupId)) {
        return;
      }
      throw new AuthorizationError(
        `Manager ${user.displayName} is not authorized to manage support group ${supportGroupId}`
      );
    }

    throw new AuthorizationError(
      `Role ${user.role} is not permitted to modify support group rosters`
    );
  }

  /**
   * Asserts that the user is permitted to trigger synchronization operations.
   */
  public static assertCanExecuteSync(user: SessionUser): void {
    if (user.role !== Role.ROSTER_ADMIN) {
      throw new AuthorizationError(
        "Only ROSTER_ADMIN can trigger synchronization or dry-run operations"
      );
    }
  }

  /**
   * Asserts that the user is a ROSTER_ADMIN.
   */
  public static assertAdmin(user: SessionUser): void {
    if (user.role !== Role.ROSTER_ADMIN) {
      throw new AuthorizationError(
        "Only ROSTER_ADMIN can access this administrative function"
      );
    }
  }

  /**
   * Checks whether the user has access to view a support group's roster.
   */
  public static canViewSupportGroup(
    user: SessionUser,
    supportGroupId: string
  ): boolean {
    if (user.role === Role.ROSTER_ADMIN) return true;
    if (user.role === Role.ROSTER_MANAGER) {
      return user.managedGroupIds.includes(supportGroupId);
    }
    // ROSTER_USER can view their own groups
    return true;
  }
}
