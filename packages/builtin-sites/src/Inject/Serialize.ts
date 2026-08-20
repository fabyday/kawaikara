/**
 * Convert a self-contained, typed page-world function into code accepted by
 * Electron's executeJavaScript API. Entry points must not close over imports.
 */
export function serializePageInjection(entryPoint: () => void): string {
  return `(${entryPoint.toString()})();`;
}

export function serializePageInjectionWithOptions<T>(
  entryPoint: (options: T) => unknown,
  options: T,
): string {
  return `(${entryPoint.toString()})(${JSON.stringify(options)});`;
}
