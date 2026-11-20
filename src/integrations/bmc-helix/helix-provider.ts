import { getAppConfig } from "@/lib/config";
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
import { SafeLogger } from "@/server/logging/logger";

export class RealBmcAuthenticationProvider implements BmcAuthenticationProvider {
  public readonly implementationStatus: ImplementationStatus =
    "VERIFIED_IMPLEMENTATION";

  private token: string | null = null;
  private tokenExpiresAt: Date | null = null;

  async authenticate(): Promise<BmcAuthenticationResult> {
    const config = getAppConfig();
    const baseUrl = config.BMC_BASE_URL?.replace(/\/+$/, "");
    const username = config.BMC_USERNAME;
    const password = config.BMC_PASSWORD;

    if (!baseUrl || !username || !password) {
      return {
        success: false,
        errorCode: "MISSING_CREDENTIALS",
        errorMessage: "BMC_BASE_URL, BMC_USERNAME, and BMC_PASSWORD must be configured",
      };
    }

    // Check cached token
    if (this.token && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return {
        success: true,
        token: this.token,
        expiresAt: this.tokenExpiresAt,
      };
    }

    try {
      const loginUrl = `${baseUrl}/api/jwt/login`;
      SafeLogger.info("Attempting BMC Helix JWT authentication", {
        url: loginUrl,
        username,
      });

      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);

      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        SafeLogger.error("BMC Helix authentication failed", {
          status: response.status,
          statusText: response.statusText,
          response: errorText,
        });

        return {
          success: false,
          errorCode: `HTTP_${response.status}`,
          errorMessage: `BMC Helix authentication failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const token = (await response.text()).trim();
      this.token = token;
      // Default AR-JWT expiration is typically 60 minutes; buffer by 5 minutes
      this.tokenExpiresAt = new Date(Date.now() + 55 * 60 * 1000);

      SafeLogger.info("BMC Helix JWT authentication succeeded");
      return {
        success: true,
        token,
        expiresAt: this.tokenExpiresAt,
      };
    } catch (error: any) {
      SafeLogger.error("Network error during BMC Helix authentication", {
        error: error.message,
      });
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: `Failed to connect to BMC Helix: ${error.message}`,
      };
    }
  }

  async invalidateToken(): Promise<void> {
    if (this.token) {
      const config = getAppConfig();
      const baseUrl = config.BMC_BASE_URL?.replace(/\/+$/, "");
      if (baseUrl) {
        try {
          await fetch(`${baseUrl}/api/jwt/logout`, {
            method: "POST",
            headers: {
              Authorization: `AR-JWT ${this.token}`,
            },
          });
        } catch (e) {
          // ignore logout network errors
        }
      }
    }
    this.token = null;
    this.tokenExpiresAt = null;
  }

  async getValidToken(): Promise<string | null> {
    const auth = await this.authenticate();
    return auth.token || null;
  }
}

export class RealBmcDirectoryProvider implements BmcDirectoryProvider {
  public readonly implementationStatus: ImplementationStatus =
    "VERIFIED_IMPLEMENTATION";

  constructor(private authProvider: RealBmcAuthenticationProvider) {}

  async getPeople(): Promise<BmcPerson[]> {
    const token = await this.authProvider.getValidToken();
    if (!token) throw new Error("BMC Helix authentication required");

    const config = getAppConfig();
    const baseUrl = config.BMC_BASE_URL?.replace(/\/+$/, "");
    const url = `${baseUrl}/api/arsys/v1/entry/CTM:People?q='Profile Status'="Enabled"&limit=100&fields=values(Person ID,Remedy Login ID,First Name,Last Name,Internet E-mail,Profile Status)`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `AR-JWT ${token}` },
      });
      if (!res.ok) {
        SafeLogger.warn("Failed to query CTM:People from BMC Helix", { status: res.status });
        return [];
      }
      const data = await res.json();
      const entries = data.entries || [];
      return entries.map((entry: any) => {
        const v = entry.values || {};
        return {
          bmcPersonId: v["Person ID"] || entry.id || "",
          loginId: v["Remedy Login ID"] || "",
          fullName: `${v["First Name"] || ""} ${v["Last Name"] || ""}`.trim(),
          email: v["Internet E-mail"] || "",
          active: v["Profile Status"] === "Enabled",
        };
      });
    } catch (err: any) {
      SafeLogger.error("Error fetching people from BMC Helix", { error: err.message });
      return [];
    }
  }

  async getPeopleByIds(personIds: string[]): Promise<BmcPerson[]> {
    if (!personIds || personIds.length === 0) return [];

    const token = await this.authProvider.getValidToken();
    if (!token) throw new Error("BMC Helix authentication required");

    const config = getAppConfig();
    const baseUrl = config.BMC_BASE_URL?.replace(/\/+$/, "");
    const results: BmcPerson[] = [];

    // Chunk into batches of 25 to respect AR System query length limits
    const chunkSize = 25;
    for (let i = 0; i < personIds.length; i += chunkSize) {
      const chunk = personIds.slice(i, i + chunkSize);
      const orClauses = chunk
        .map((id) => `'Person ID'="${id.replace(/"/g, '\\"')}"`)
        .join(" OR ");
      const q = `(${orClauses})`;
      const fields = "values(Person ID,Remedy Login ID,First Name,Last Name,Internet E-mail,Profile Status)";
      const url = `${baseUrl}/api/arsys/v1/entry/CTM:People?q=${encodeURIComponent(
        q
      )}&limit=${chunk.length}&fields=${encodeURIComponent(fields)}`;

      try {
        const res = await fetch(url, {
          headers: { Authorization: `AR-JWT ${token}` },
        });
        if (!res.ok) {
          SafeLogger.warn("Failed to query CTM:People batch from BMC Helix", {
            status: res.status,
            chunkCount: chunk.length,
          });
          continue;
        }
        const data = await res.json();
        const entries = data.entries || [];
        for (const entry of entries) {
          const v = entry.values || {};
          const fullName =
            `${v["First Name"] || ""} ${v["Last Name"] || ""}`.trim() ||
            v["Remedy Login ID"] ||
            "Unknown";
          results.push({
            bmcPersonId: v["Person ID"] || entry.id || "",
            loginId: v["Remedy Login ID"] || "",
            fullName,
            email: v["Internet E-mail"] || "",
            active: v["Profile Status"] === "Enabled",
          });
        }
      } catch (err: any) {
        SafeLogger.error("Error fetching people batch from BMC Helix", {
          error: err.message,
        });
      }
    }

    return results;
  }

  async getPerson(personId: string): Promise<BmcPerson | null> {
    const people = await this.getPeopleByIds([personId]);
    return people[0] || null;
  }

  async getSupportGroups(): Promise<BmcSupportGroup[]> {
    return this.searchSupportGroups(undefined, undefined, 100);
  }

  async getSupportGroup(supportGroupId: string): Promise<BmcSupportGroup | null> {
    const token = await this.authProvider.getValidToken();
    if (!token) throw new Error("BMC Helix authentication required");

    const config = getAppConfig();
    const baseUrl = config.BMC_BASE_URL?.replace(/\/+$/, "");
    const q = `'Support Group ID'="${supportGroupId.replace(/"/g, '\\"')}"`;
    const url = `${baseUrl}/api/arsys/v1/entry/CTM:Support Group?q=${encodeURIComponent(
      q
    )}&limit=1&fields=values(Support Group ID,Support Group Name,Company,Support Organization,Status)`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `AR-JWT ${token}` },
      });
      if (!res.ok) {
        SafeLogger.warn("Failed to query CTM:Support Group by ID from BMC Helix", {
          status: res.status,
          supportGroupId,
        });
        return null;
      }
      const data = await res.json();
      const entries = data.entries || [];
      if (entries.length === 0) return null;
      const v = entries[0].values || {};
      return {
        bmcSupportGroupId: v["Support Group ID"] || entries[0].id || supportGroupId,
        name: v["Support Group Name"] || "",
        company: v["Company"] || "",
        organization: v["Support Organization"] || "",
        active: v["Status"] === "Enabled",
      };
    } catch (err: any) {
      SafeLogger.error("Error fetching support group from BMC Helix", {
        error: err.message,
        supportGroupId,
      });
      return null;
    }
  }

  async searchSupportGroups(
    query?: string,
    company?: string,
    limit: number = 25
  ): Promise<BmcSupportGroup[]> {
    const token = await this.authProvider.getValidToken();
    if (!token) throw new Error("BMC Helix authentication required");

    const config = getAppConfig();
    const baseUrl = config.BMC_BASE_URL?.replace(/\/+$/, "");

    let q = `'Status'="Enabled"`;
    if (query && query.trim()) {
      const safeQ = query.trim().replace(/"/g, '\\"');
      q += ` AND ('Support Group Name' LIKE "%${safeQ}%" OR 'Support Group ID' = "${safeQ}")`;
    }
    if (company && company.trim()) {
      const safeComp = company.trim().replace(/"/g, '\\"');
      q += ` AND 'Company' = "${safeComp}"`;
    }

    const url = `${baseUrl}/api/arsys/v1/entry/CTM:Support Group?q=${encodeURIComponent(
      q
    )}&limit=${limit}&fields=values(Support Group ID,Support Group Name,Company,Support Organization,Status)`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `AR-JWT ${token}` },
      });
      if (!res.ok) {
        SafeLogger.warn("Failed to search CTM:Support Group from BMC Helix", {
          status: res.status,
        });
        return [];
      }
      const data = await res.json();
      const entries = data.entries || [];
      return entries.map((entry: any) => {
        const v = entry.values || {};
        return {
          bmcSupportGroupId: v["Support Group ID"] || entry.id || "",
          name: v["Support Group Name"] || "",
          company: v["Company"] || "",
          organization: v["Support Organization"] || "",
          active: v["Status"] === "Enabled",
        };
      });
    } catch (err: any) {
      SafeLogger.error("Error searching support groups from BMC Helix", {
        error: err.message,
      });
      return [];
    }
  }

  async getSupportGroupMembers(supportGroupId: string): Promise<BmcSupportGroupMember[]> {
    const token = await this.authProvider.getValidToken();
    if (!token) throw new Error("BMC Helix authentication required");

    const config = getAppConfig();
    const baseUrl = config.BMC_BASE_URL?.replace(/\/+$/, "");
    const form = "CTM:Support Group Association";
    const q = `'Support Group ID'="${supportGroupId.replace(/"/g, '\\"')}"`;
    const fields = "values(Person ID,Support Group ID,Assignment Availability,Status,Default)";
    const url = `${baseUrl}/api/arsys/v1/entry/${encodeURIComponent(form)}?q=${encodeURIComponent(
      q
    )}&fields=${encodeURIComponent(fields)}&limit=500`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `AR-JWT ${token}` },
      });
      if (!res.ok) {
        SafeLogger.warn("Failed to query CTM:Support Group Association from BMC Helix", { status: res.status });
        return [];
      }
      const data = await res.json();
      const entries = data.entries || [];
      return entries.map((entry: any) => {
        const v = entry.values || {};
        return {
          bmcPersonId: v["Person ID"] || "",
          bmcSupportGroupId: v["Support Group ID"] || supportGroupId,
          currentBmcAvailability: v["Assignment Availability"] === "Yes",
          defaultGroup: v["Default"] === "Yes",
          active: v["Status"] === "Enabled",
        };
      });
    } catch (err: any) {
      SafeLogger.error("Error fetching group members from BMC Helix", { error: err.message });
      return [];
    }
  }
}
