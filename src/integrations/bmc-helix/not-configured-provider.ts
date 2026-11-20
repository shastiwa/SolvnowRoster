import {
  BmcAuthenticationProvider,
  BmcAvailabilityProvider,
  BmcDirectoryProvider,
  ImplementationStatus,
} from "./interfaces";
import {
  BmcAuthenticationResult,
  BmcAvailabilityReadResult,
  BmcAvailabilityUpdateResult,
  BmcPerson,
  BmcSupportGroup,
  BmcSupportGroupMember,
} from "./types";

export class NotConfiguredBmcAvailabilityProvider
  implements BmcAvailabilityProvider
{
  public readonly implementationStatus: ImplementationStatus =
    "CONFIGURATION_REQUIRED";

  async getAvailability(
    personId: string,
    supportGroupId: string
  ): Promise<BmcAvailabilityReadResult> {
    return {
      success: false,
      errorCode: "CONFIGURATION_REQUIRED",
      errorMessage:
        "BMC Helix 26.2 endpoint, form name, and field IDs for assignment availability read have not been verified.",
      httpStatus: 501,
    };
  }

  async setAvailability(
    personId: string,
    supportGroupId: string,
    available: boolean,
    correlationId: string
  ): Promise<BmcAvailabilityUpdateResult> {
    return {
      success: false,
      status: "CONFIGURATION_REQUIRED",
      errorCode: "CONFIGURATION_REQUIRED",
      errorMessage:
        "BMC Helix 26.2 verified REST API endpoint, AR System form name, qualification syntax, and field IDs for assignment availability update have not been supplied.",
      httpStatus: 501,
      correlationId,
    };
  }
}

export class NotConfiguredBmcAuthenticationProvider
  implements BmcAuthenticationProvider
{
  public readonly implementationStatus: ImplementationStatus =
    "CONFIGURATION_REQUIRED";

  async authenticate(): Promise<BmcAuthenticationResult> {
    return {
      success: false,
      errorCode: "CONFIGURATION_REQUIRED",
      errorMessage:
        "BMC Helix 26.2 authentication URL and credentials are not verified.",
    };
  }

  async invalidateToken(): Promise<void> {
    // no-op
  }
}

export class NotConfiguredBmcDirectoryProvider
  implements BmcDirectoryProvider
{
  public readonly implementationStatus: ImplementationStatus =
    "CONFIGURATION_REQUIRED";

  async getPeople(): Promise<BmcPerson[]> {
    return [];
  }

  async getPeopleByIds(personIds: string[]): Promise<BmcPerson[]> {
    return [];
  }

  async getPerson(personId: string): Promise<BmcPerson | null> {
    return null;
  }

  async getSupportGroups(): Promise<BmcSupportGroup[]> {
    return [];
  }

  async getSupportGroup(supportGroupId: string): Promise<BmcSupportGroup | null> {
    return null;
  }

  async searchSupportGroups(
    query?: string,
    company?: string,
    limit?: number
  ): Promise<BmcSupportGroup[]> {
    return [];
  }

  async getSupportGroupMembers(
    supportGroupId: string
  ): Promise<BmcSupportGroupMember[]> {
    return [];
  }
}
