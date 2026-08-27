/** Performs the require development project ID operation. */
export function requireDevelopmentProjectId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) {
    throw new TypeError('Development project id must be a valid string.');
  }
  return value;
}

/** Validates the development inspector port. */
export function validateDevelopmentInspectorPort(
  value: unknown,
  fallback: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1_024 ||
    value > 65_535
  ) {
    return fallback;
  }
  return value;
}
