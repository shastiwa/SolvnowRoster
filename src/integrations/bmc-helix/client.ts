import { getAppConfig } from "@/lib/config";
import {
  BmcAuthenticationProvider,
  BmcAvailabilityProvider,
  BmcDirectoryProvider,
  BmcHelixIntegrationProvider,
} from "./interfaces";
import {
  MockBmcAuthenticationProvider,
  MockBmcAvailabilityProvider,
  MockBmcDirectoryProvider,
} from "./mock-provider";
import {
  NotConfiguredBmcAuthenticationProvider,
  NotConfiguredBmcAvailabilityProvider,
  NotConfiguredBmcDirectoryProvider,
} from "./not-configured-provider";
import {
  RealBmcAuthenticationProvider,
  RealBmcAvailabilityProvider,
  RealBmcDirectoryProvider,
} from "./helix-provider";

class BmcClientManager {
  private static instance: BmcClientManager;
  private mockAuth = new MockBmcAuthenticationProvider();
  private mockDirectory = new MockBmcDirectoryProvider();
  private mockAvailability = new MockBmcAvailabilityProvider(this.mockDirectory);

  private notConfiguredAuth = new NotConfiguredBmcAuthenticationProvider();
  private notConfiguredDirectory = new NotConfiguredBmcDirectoryProvider();
  private notConfiguredAvailability = new NotConfiguredBmcAvailabilityProvider();

  private realAuth = new RealBmcAuthenticationProvider();
  private realDirectory = new RealBmcDirectoryProvider(this.realAuth);
  private realAvailability = new RealBmcAvailabilityProvider(this.realAuth);

  public static getInstance(): BmcClientManager {
    if (!BmcClientManager.instance) {
      BmcClientManager.instance = new BmcClientManager();
    }
    return BmcClientManager.instance;
  }

  public getProvider(): BmcHelixIntegrationProvider {
    const config = getAppConfig();

    if (config.BMC_PROVIDER_MODE === "mock") {
      return {
        auth: this.mockAuth,
        directory: this.mockDirectory,
        availability: this.mockAvailability,
      };
    }

    // In 'helix' mode: Check if integration credentials and URLs exist
    const hasCredentials =
      Boolean(config.BMC_BASE_URL) &&
      Boolean(config.BMC_USERNAME) &&
      Boolean(config.BMC_PASSWORD);

    if (!hasCredentials) {
      return {
        auth: this.notConfiguredAuth,
        directory: this.notConfiguredDirectory,
        availability: this.notConfiguredAvailability,
      };
    }

    // Live BMC Helix Provider with real AR-JWT auth, CTM:People/Support Group directory,
    // and CTM:Support Group Association assignment availability updates
    return {
      auth: this.realAuth,
      directory: this.realDirectory,
      availability: this.realAvailability,
    };
  }

  public getMockDirectoryProvider(): MockBmcDirectoryProvider {
    return this.mockDirectory;
  }

  public getRealAuthProvider(): RealBmcAuthenticationProvider {
    return this.realAuth;
  }
}

export const bmcClientManager = BmcClientManager.getInstance();
export const getBmcProvider = () => bmcClientManager.getProvider();
