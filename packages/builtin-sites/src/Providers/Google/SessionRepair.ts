import type {
  SiteContext,
  SiteCookieMetadata,
} from '@kawaikara/site-api';

const GOOGLE_SESSION_DOMAINS = [
  'google.com',
  'google.co.kr',
  'google.co.jp',
  'youtube.com',
] as const;

const GOOGLE_AUTH_COOKIE_NAMES = [
  'ACCOUNT_CHOOSER',
  'LSID',
  'LSOLH',
  'SMSV',
  'SID',
  'HSID',
  'SSID',
  'APISID',
  'SAPISID',
  'SIDCC',
  'LOGIN_INFO',
  '__Host-1PLSID',
  '__Host-3PLSID',
  '__Host-GAPS',
  '__Secure-1PAPISID',
  '__Secure-1PSID',
  '__Secure-1PSIDCC',
  '__Secure-1PSIDTS',
  '__Secure-3PAPISID',
  '__Secure-3PSID',
  '__Secure-3PSIDCC',
  '__Secure-3PSIDTS',
] as const;

/**
 * Retired external-login builds could import only the regional Google cookie
 * family. accounts.google.com then sees an account while YouTube and
 * google.com do not, making BootstrapSession redirect indefinitely. Repair
 * only that exact incomplete shape; a complete single- or multi-account
 * Session is never cleared.
 */
export async function repairIncompleteGoogleSession(
  context: SiteContext,
): Promise<void> {
  if (!context.cookies) return;

  const cookies = await context.cookies.list({ domains: GOOGLE_SESSION_DOMAINS });
  const hasAccountsSession = hasCookie(cookies, 'accounts.google.com', 'LSID');
  const hasPrimarySession = hasCookie(cookies, 'google.com', 'SID');
  const hasYouTubeSession = hasCookie(cookies, 'youtube.com', 'LOGIN_INFO');
  const hasRegionalSession = cookies.some((cookie) => {
    const domain = normalizeCookieDomain(cookie.domain);
    return cookie.name === 'SID' &&
      domain !== 'google.com' &&
      /^google\.(?:co\.kr|co\.jp)$/.test(domain);
  });

  if (
    !hasAccountsSession ||
    !hasRegionalSession ||
    hasPrimarySession ||
    hasYouTubeSession
  ) {
    return;
  }

  const removedCount = await context.cookies.clear({
    domains: GOOGLE_SESSION_DOMAINS,
    names: GOOGLE_AUTH_COOKIE_NAMES,
  });
  context.logger.warn(
    `Repaired an incomplete Google authentication session (${removedCount} stale cookies removed).`,
  );
}

function hasCookie(
  cookies: readonly SiteCookieMetadata[],
  domain: string,
  name: string,
): boolean {
  return cookies.some((cookie) =>
    cookie.name === name && normalizeCookieDomain(cookie.domain) === domain,
  );
}

function normalizeCookieDomain(domain: string): string {
  return domain.replace(/^\./, '').toLowerCase();
}
