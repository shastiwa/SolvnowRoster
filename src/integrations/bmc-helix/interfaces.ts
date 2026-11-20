import {
  BmcAuthenticationResult,
  BmcAvailabilityReadResult,
  BmcAvailabilityUpdateResult,
  BmcPerson,
  BmcSupportGroup,
  BmcSupportGroupMember,
} from "./types";

export type ImplementationStatus =
  | "VERIFIED_IMPLEMENTATION"
  | "MOCK_DEVELOPMENT_IMPLEMENTATION"
  | "CONFIGURATION_REQUIRED";

export interface BmcAuthenticationProvider {
  readonly implementationStatus: ImplementationStatus;
  authenticate(): Promise<BmcAuthenticationResult>;
  invalidateToken(): Promise<void>;
}

export interface BmcDirectoryProvider {
  readonly implementationStatus: ImplementationStatus;
  getPeople(): Promise<BmcPerson[]>;
  getPeopleByIds(personIds: string[]): Promise<BmcPerson[]>;
  getPerson(personId: string): Promise<BmcPerson | null>;
  getSupportGroups(): Promise<BmcSupportGroup[]>;
  getSupportGroup(supportGroupId: string): Promise<BmcSupportGroup | null>;
  searchSupportGroups(
    query?: string,
    company?: string,
    limit?: number
  ): Promise<BmcSupportGroup[]>;
  getSupportGroupMembers(
    supportGroupId: string
  ): Promise<BmcSupportGroupMember[]>;
}

export interface BmcAvailabilityProvider {
  readonly implementationStatus: ImplementationStatus;
  getAvailability(
    personId: string,
    supportGroupId: string
  ): Promise<BmcAvailabilityReadResult>;

  setAvailability(
    personId: string,
    supportGroupId: string,
    available: boolean,
    correlationId: string
  ): Promise<BmcAvailabilityUpdateResult>;
}

export interface BmcHelixIntegrationProvider {
  auth: BmcAuthenticationProvider;
  directory: BmcDirectoryProvider;
  availability: BmcAvailabilityProvider;
}
