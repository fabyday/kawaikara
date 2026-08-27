import { createRequire } from 'node:module';
import path from 'node:path';

/** Performs the evict require cache operation. */
export function evictRequireCache(rootPath: string): void {
  const normalizedRoot = `${path.resolve(rootPath)}${path.sep}`;
  const scopedRequire = createRequire(path.join(rootPath, '__cache__.cjs'));
  for (const modulePath of Object.keys(scopedRequire.cache)) {
    const normalizedModule = path.resolve(modulePath);
    if (
      normalizedModule === path.resolve(rootPath) ||
      normalizedModule.startsWith(normalizedRoot)
    ) {
      delete scopedRequire.cache[modulePath];
    }
  }
}
