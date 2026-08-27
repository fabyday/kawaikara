import type {
  ProviderLocaleResource,
  SiteLocaleContribution,
} from '@kawaikara/site-api';
import path from 'node:path';

/** Validates the provider locale contribution. */
export function validateProviderLocaleContribution(
  value: unknown,
): SiteLocaleContribution | undefined {
  if (value === undefined) return undefined;
  const candidate = requireJsonObject(value, 'Provider locale contribution');
  const allowed = new Set(['resource', 'supportedLocales', 'defaultLocale']);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) {
      throw new Error(`Provider locale contribution contains unknown field ${key}.`);
    }
  }
  const resource = candidate.resource === undefined
    ? undefined
    : requireSafeRelativePath(candidate.resource, 'Provider locale resource');
  if (resource && !resource.toLowerCase().endsWith('.json')) {
    throw new Error('Provider locale resource must be a JSON file.');
  }
  return Object.freeze({
    /** The resource value. */
    resource,
    /** The supported locales value. */
    supportedLocales: candidate.supportedLocales === undefined
      ? []
      : validateStringArray(
          candidate.supportedLocales,
          'Provider supportedLocales',
          40,
        ),
    /** The default locale value. */
    defaultLocale: optionalBoundedString(
      candidate.defaultLocale,
      'Provider defaultLocale',
      40,
    ),
  });
}

/** Validates the provider locale resource. */
export function validateProviderLocaleResource(
  value: unknown,
): ProviderLocaleResource {
  const candidate = requireJsonObject(value, 'Provider locale resource');
  const locales = Object.entries(candidate);
  if (locales.length === 0 || locales.length > 40) {
    throw new Error('Provider locale resource must contain 1 to 40 locales.');
  }
  return Object.freeze(Object.fromEntries(locales.map(([locale, rawMessages]) => {
    if (!locale.trim() || locale.length > 40) {
      throw new Error(`Provider locale resource has invalid locale ${locale}.`);
    }
    const messages = Object.entries(requireJsonObject(
      rawMessages,
      `Provider locale ${locale}`,
    ));
    if (messages.length === 0 || messages.length > 500) {
      throw new Error(`Provider locale ${locale} must contain 1 to 500 messages.`);
    }
    return [locale, Object.freeze(Object.fromEntries(messages.map(([key, text]) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(key)) {
        throw new Error(`Provider locale ${locale} has invalid message key ${key}.`);
      }
      return [key, requireBoundedString(
        text,
        `Provider locale message ${locale}.${key}`,
        2_000,
      )];
    })))] as const;
  })));
}

/** Performs the require JSON object operation. */
export function requireJsonObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

/** Validates the string array. */
export function validateStringArray(
  value: unknown,
  field: string,
  maxLength: number,
): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  return Object.freeze(
    value.map((item) => requireBoundedString(item, field, maxLength)),
  );
}

/** Performs the require bounded string operation. */
export function requireBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} is empty or too long.`);
  }
  return normalized;
}

/** Performs the optional bounded string operation. */
export function optionalBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  return value === undefined
    ? undefined
    : requireBoundedString(value, field, maxLength);
}

/** Performs the require safe relative path operation. */
export function requireSafeRelativePath(value: unknown, field: string): string {
  const normalized = requireBoundedString(value, field, 300);
  const segments = normalized.split('/');
  if (
    normalized.includes('\\') ||
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:/.test(normalized) ||
    segments.some((segment) => !segment || segment === '..' || segment === '.')
  ) {
    throw new Error(`${field} must be a safe relative path.`);
  }
  return normalized;
}
