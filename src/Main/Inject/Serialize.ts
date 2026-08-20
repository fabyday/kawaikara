/** Serialize a self-contained, typed function for a remote page world. */
export function serializePageInjection(entryPoint: () => unknown): string {
  return `(${entryPoint.toString()})();`;
}

export function serializePageInjectionWithOptions<T>(
  entryPoint: (options: T) => unknown,
  options: T,
): string {
  return `(${entryPoint.toString()})(${JSON.stringify(options)});`;
}
