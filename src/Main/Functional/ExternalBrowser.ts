import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { Cookie } from 'patchright';

/** Describes the active external login contract. */
export interface ActiveExternalLogin {
  /** Determines whether the cel condition applies. */
  cancel(): Promise<void>;
}

/** Creates the cookie jar fingerprint. */
export function createCookieJarFingerprint(cookies: readonly Cookie[]): string {
  const serialized = cookies
    .map((cookie) => [
      cookie.domain,
      cookie.path,
      cookie.name,
      cookie.value,
      cookie.expires,
      cookie.partitionKey ?? '',
    ].join('\u0000'))
    .sort()
    .join('\u0001');
  return createHash('sha256').update(serialized).digest('hex');
}

/** Determines whether the google login cookie condition applies. */
export function isGoogleLoginCookie(cookie: Cookie): boolean {
  const domain = normalizeCookieDomain(cookie.domain);
  return domain === 'google.com' || domain.endsWith('.google.com') ||
    domain === 'google.co.kr' || domain.endsWith('.google.co.kr') ||
    domain === 'youtube.com' || domain.endsWith('.youtube.com');
}

/** Determines whether the google multi login cookie condition applies. */
export function isGoogleMultiLoginCookie(cookie: Cookie): boolean {
  return cookie.name === 'LSOLH' &&
    normalizeCookieDomain(cookie.domain) === 'accounts.google.com';
}

/** Validates the reset origins. */
export function validateResetOrigins(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.pathname !== '/' || url.search || url.hash
    ) {
      throw new Error(`External-login reset origin is not a safe HTTPS origin: ${value}`);
    }
    return url.origin;
  }))];
}

/** Formats the observed URL. */
export function formatObservedUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '<unparseable-url>';
  }
}

/** Determines whether the expected navigation interruption condition applies. */
export function isExpectedNavigationInterruption(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:net::)?ERR_ABORTED|navigation.*(?:interrupted|aborted)/i.test(message);
}

/** Removes the temporary profile. */
export async function removeTemporaryProfile(profilePath: string): Promise<void> {
  const retryDelays = [0, 80, 220, 500, 1_000] as const;
  let lastError: unknown;
  for (const delay of retryDelays) {
    if (delay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
    try {
      await rm(profilePath, { recursive: true, force: true, maxRetries: 2
      });
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableProfileCleanupError(error)) throw error;
    }
  }
  console.warn(
    `Temporary external-login profile is still locked and will be left for the operating system to clean: ${profilePath}`,
    lastError,
  );
}

/** Normalizes the cookie domain. */
export function normalizeCookieDomain(value: string | undefined): string {
  return (value ?? '').replace(/^\./, '').toLowerCase();
}

/** Determines whether the retryable profile cleanup error condition applies. */
function isRetryableProfileCleanupError(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : '';
  return code === 'EBUSY' || code === 'EPERM' || code === 'ENOTEMPTY';
}
