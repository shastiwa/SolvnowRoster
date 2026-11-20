import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { AuthorizationService } from "@/server/authorization/service";
import { getBmcProvider } from "@/integrations/bmc-helix/client";
import { getAppConfig } from "@/lib/config";

export async function POST() {
  try {
    const user = await getCurrentUser();
    AuthorizationService.assertAdmin(user);

    const config = getAppConfig();
    const bmc = getBmcProvider();

    const authResult = await bmc.auth.authenticate();

    return NextResponse.json({
      mode: config.BMC_PROVIDER_MODE,
      baseUrl: config.BMC_BASE_URL,
      username: config.BMC_USERNAME,
      success: authResult.success,
      errorMessage: authResult.errorMessage,
      errorCode: authResult.errorCode,
      hasToken: Boolean(authResult.token),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to test connection" },
      { status: 500 }
    );
  }
}
