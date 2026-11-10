import { z } from "zod";
import type { Config } from "../config.js";
import { AppError } from "../domain/errors.js";
export type VerifyMember = (token: string) => Promise<string>;
export function supabaseVerifier(
  config: Config,
  fetcher: typeof fetch = fetch,
  onVerified?: (id: string, email?: string, provider?: string) => Promise<void>,
): VerifyMember {
  return async (token) => {
    if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY)
      throw new AppError("ACCOUNT_NOT_READY", 503);
    if (!token || token.length > 8192)
      throw new AppError("MEMBER_UNAUTHORIZED", 401);
    let response: Response;
    try {
      response = await fetcher(`${config.SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: config.SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new AppError("AUTH_UNAVAILABLE", 503);
    }
    if (!response.ok)
      throw new AppError(
        response.status >= 500 ? "AUTH_UNAVAILABLE" : "MEMBER_UNAUTHORIZED",
        response.status >= 500 ? 503 : 401,
      );
    const user = z
      .object({
        id: z.string().uuid(),
        is_anonymous: z.boolean().optional(),
        email: z.string().optional(),
        email_confirmed_at: z.string().nullable().optional(),
        app_metadata: z.object({ provider: z.string().optional() }).optional(),
      })
      .safeParse(await response.json());
    if (
      !user.success ||
      user.data.is_anonymous ||
      (user.data.app_metadata?.provider === "email" &&
        !user.data.email_confirmed_at)
    )
      throw new AppError("MEMBER_UNAUTHORIZED", 401);
    await onVerified?.(
      user.data.id,
      user.data.email,
      user.data.app_metadata?.provider,
    );
    return user.data.id;
  };
}
