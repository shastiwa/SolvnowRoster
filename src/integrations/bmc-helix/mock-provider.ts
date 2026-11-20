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

export class MockBmcAuthenticationProvider implements BmcAuthenticationProvider {
  public readonly implementationStatus: ImplementationStatus =
    "MOCK_DEVELOPMENT_IMPLEMENTATION";

  async authenticate(): Promise<BmcAuthenticationResult> {
    return {
      success: true,
      token: "mock-jwt-token-helix-26.2-dev",
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  async invalidateToken(): Promise<void> {
    // no-op for mock
  }
}

export class MockBmcDirectoryProvider implements BmcDirectoryProvider {
  public readonly implementationStatus: ImplementationStatus =
    "MOCK_DEVELOPMENT_IMPLEMENTATION";

  private mockCompanies = ["Calbro Services", "Apex Global"];

  private mockSupportGroups: BmcSupportGroup[] = [
    {
      bmcSupportGroupId: "SGP000000001001",
      name: "Service Desk Level 1",
      company: "Calbro Services",
      organization: "IT Support",
      active: true,
    },
    {
      bmcSupportGroupId: "SGP000000001002",
      name: "Major Incident Management",
      company: "Calbro Services",
      organization: "IT Support",
      active: true,
    },
    {
      bmcSupportGroupId: "SGP000000001003",
      name: "Cloud Operations",
      company: "Calbro Services",
      organization: "Infrastructure",
      active: true,
    },
    {
      bmcSupportGroupId: "SGP000000001004",
      name: "Network Engineering",
      company: "Apex Global",
      organization: "Infrastructure",
      active: true,
    },
  ];

  private mockPeople: BmcPerson[] = [
    {
      bmcPersonId: "PPL000000000001",
      loginId: "arun.kumar",
      fullName: "Arun Kumar",
      email: "arun.kumar@example.com",
      active: true,
    },
    {
      bmcPersonId: "PPL000000000002",
      loginId: "priya.sharma",
      fullName: "Priya Sharma",
      email: "priya.sharma@example.com",
      active: true,
    },
    {
      bmcPersonId: "PPL000000000003",
      loginId: "rahul.verma",
      fullName: "Rahul Verma",
      email: "rahul.verma@example.com",
      active: true,
    },
    {
      bmcPersonId: "PPL000000000004",
      loginId: "ananya.patel",
      fullName: "Ananya Patel",
      email: "ananya.patel@example.com",
      active: true,
    },
    {
      bmcPersonId: "PPL000000000005",
      loginId: "vikram.singh",
      fullName: "Vikram Singh",
      email: "vikram.singh@example.com",
      active: true,
    },
  ];

  // Note: Arun Kumar and Priya Sharma belong to multiple support groups!
  private mockMembers: BmcSupportGroupMember[] = [
    // Service Desk Level 1
    {
      bmcPersonId: "PPL000000000001",
      bmcSupportGroupId: "SGP000000001001",
      currentBmcAvailability: true,
      defaultGroup: true,
      active: true,
    },
    {
      bmcPersonId: "PPL000000000002",
      bmcSupportGroupId: "SGP000000001001",
      currentBmcAvailability: false,
      defaultGroup: true,
      active: true,
    },
    {
      bmcPersonId: "PPL000000000003",
      bmcSupportGroupId: "SGP000000001001",
      currentBmcAvailability: true,
      defaultGroup: true,
      active: true,
    },
    // Major Incident Management (Arun Kumar cross-assigned)
    {
      bmcPersonId: "PPL000000000001",
      bmcSupportGroupId: "SGP000000001002",
      currentBmcAvailability: false,
      defaultGroup: false,
      active: true,
    },
    {
      bmcPersonId: "PPL000000000004",
      bmcSupportGroupId: "SGP000000001002",
      currentBmcAvailability: true,
      defaultGroup: true,
      active: true,
    },
    // Cloud Operations (Priya Sharma cross-assigned)
    {
      bmcPersonId: "PPL000000000002",
      bmcSupportGroupId: "SGP000000001003",
      currentBmcAvailability: true,
      defaultGroup: false,
      active: true,
    },
    {
      bmcPersonId: "PPL000000000005",
      bmcSupportGroupId: "SGP000000001003",
      currentBmcAvailability: false,
      defaultGroup: true,
      active: true,
    },
    // Network Engineering
    {
      bmcPersonId: "PPL000000000005",
      bmcSupportGroupId: "SGP000000001004",
      currentBmcAvailability: false,
      defaultGroup: false,
      active: true,
    },
  ];

  async getPeople(): Promise<BmcPerson[]> {
    return [...this.mockPeople];
  }

  async getPeopleByIds(personIds: string[]): Promise<BmcPerson[]> {
    const idSet = new Set(personIds);
    return this.mockPeople.filter((p) => idSet.has(p.bmcPersonId));
  }

  async getPerson(personId: string): Promise<BmcPerson | null> {
    return this.mockPeople.find((p) => p.bmcPersonId === personId) ?? null;
  }

  async getSupportGroups(): Promise<BmcSupportGroup[]> {
    return [...this.mockSupportGroups];
  }

  async getSupportGroup(supportGroupId: string): Promise<BmcSupportGroup | null> {
    return (
      this.mockSupportGroups.find(
        (g) => g.bmcSupportGroupId === supportGroupId
      ) ?? null
    );
  }

  async searchSupportGroups(
    query?: string,
    company?: string,
    limit: number = 25
  ): Promise<BmcSupportGroup[]> {
    let results = [...this.mockSupportGroups];
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      results = results.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.bmcSupportGroupId.toLowerCase().includes(q) ||
          g.organization.toLowerCase().includes(q)
      );
    }
    if (company && company.trim()) {
      results = results.filter(
        (g) => g.company.toLowerCase() === company.trim().toLowerCase()
      );
    }
    return results.slice(0, limit);
  }

  async getSupportGroupMembers(
    supportGroupId: string
  ): Promise<BmcSupportGroupMember[]> {
    return this.mockMembers.filter((m) => m.bmcSupportGroupId === supportGroupId);
  }

  // Helper for mock availability tracking
  public updateMemberAvailability(
    personId: string,
    supportGroupId: string,
    avail: boolean
  ) {
    const mem = this.mockMembers.find(
      (m) => m.bmcPersonId === personId && m.bmcSupportGroupId === supportGroupId
    );
    if (mem) {
      mem.currentBmcAvailability = avail;
    }
  }

  public getMember(personId: string, supportGroupId: string) {
    return this.mockMembers.find(
      (m) => m.bmcPersonId === personId && m.bmcSupportGroupId === supportGroupId
    );
  }
}

export class MockBmcAvailabilityProvider implements BmcAvailabilityProvider {
  public readonly implementationStatus: ImplementationStatus =
    "MOCK_DEVELOPMENT_IMPLEMENTATION";

  constructor(private directoryProvider: MockBmcDirectoryProvider) {}

  async getAvailability(
    personId: string,
    supportGroupId: string
  ): Promise<BmcAvailabilityReadResult> {
    const member = this.directoryProvider.getMember(personId, supportGroupId);
    if (!member) {
      return {
        success: false,
        errorCode: "MEMBER_NOT_FOUND",
        errorMessage: "Person is not a member of the specified Support Group in BMC",
        httpStatus: 404,
      };
    }

    return {
      success: true,
      available: member.currentBmcAvailability,
      httpStatus: 200,
    };
  }

  async setAvailability(
    personId: string,
    supportGroupId: string,
    available: boolean,
    correlationId: string
  ): Promise<BmcAvailabilityUpdateResult> {
    const member = this.directoryProvider.getMember(personId, supportGroupId);
    if (!member) {
      return {
        success: false,
        status: "FAILURE",
        errorCode: "MEMBER_NOT_FOUND",
        errorMessage: "Member not found in BMC Helix directory",
        httpStatus: 404,
        correlationId,
      };
    }

    this.directoryProvider.updateMemberAvailability(
      personId,
      supportGroupId,
      available
    );

    return {
      success: true,
      status: "SUCCESS",
      httpStatus: 200,
      correlationId,
    };
  }
}
