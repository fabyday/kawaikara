/**
 * Serialize a self-contained, typed function for Electron's remote page world.
 * Main/Inject modules use this boundary before their scripts reach
 * WebContents.executeJavaScript or WebFrameMain.executeJavaScript. Entry
 * functions must not close over runtime values; pass those through the options
 * overload so TypeScript and JSON serialization keep the boundary explicit.
 */
export function serializePageInjection(entryPoint: () => unknown): string {
  return `(${entryPoint.toString()})();`;
}

/** Serializes the page injection with options. */
export function serializePageInjectionWithOptions<T>(
  entryPoint: (options: T) => unknown,
  options: T,
): string {
  return `(${entryPoint.toString()})(${JSON.stringify(options)});`;
}
