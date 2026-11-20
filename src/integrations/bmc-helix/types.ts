export interface BmcAuthenticationResult {
  success: boolean;
  token?: string;
  expiresAt?: Date;
  errorMessage?: string;
  errorCode?: string;
}

export interface BmcPerson {
  bmcPersonId: string;
  loginId: string;
  fullName: string;
  email: string;
  active: boolean;
}

export interface BmcSupportGroup {
  bmcSupportGroupId: string;
  name: string;
  company: string;
  organization: string;
  active: boolean;
}

export interface BmcSupportGroupMember {
  bmcPersonId: string;
  bmcSupportGroupId: string;
  currentBmcAvailability: boolean;
  defaultGroup: boolean;
  active: boolean;
}

export interface BmcAvailabilityReadResult {
  success: boolean;
  available?: boolean;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
}

export interface BmcAvailabilityUpdateResult {
  success: boolean;
  status: "SUCCESS" | "CONFIGURATION_REQUIRED" | "FAILURE";
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
  correlationId: string;
}
