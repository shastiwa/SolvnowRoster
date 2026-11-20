import { Role } from "@prisma/client";

export { Role };

export const ROLE_PERMISSIONS = {
  [Role.ROSTER_USER]: {
    canViewOwnRoster: true,
    canViewOwnAvailability: true,
    canManageRoster: false,
    canManageOverrides: false,
    canExecuteSync: false,
    canManageAdmins: false,
    canViewAllGroups: false,
    canModifySettings: false,
  },
  [Role.ROSTER_MANAGER]: {
    canViewOwnRoster: true,
    canViewOwnAvailability: true,
    canManageRoster: true, // Only for authorized support groups!
    canManageOverrides: true, // Only for authorized support groups!
    canExecuteSync: false,
    canManageAdmins: false,
    canViewAllGroups: false, // Only managed groups
    canModifySettings: false,
  },
  [Role.ROSTER_ADMIN]: {
    canViewOwnRoster: true,
    canViewOwnAvailability: true,
    canManageRoster: true,
    canManageOverrides: true,
    canExecuteSync: true,
    canManageAdmins: true,
    canViewAllGroups: true,
    canModifySettings: true,
  },
} as const;
