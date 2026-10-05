import type { ProviderMetadata } from '@kawaikara/site-api';

/** Rejects malformed or unsupported file-drop capabilities before Bundle commit. */
export function validateFileDropContribution(metadata: ProviderMetadata): void {
  const drop = metadata.fileDrop;
  if (drop === undefined) return;
  if (!drop || typeof drop !== 'object' || Array.isArray(drop) ||
      Object.keys(drop).some(key => !['scope', 'extensions', 'action'].includes(key)) ||
      !['global', 'local'].includes(drop.scope) || drop.action !== 'open-local-video' ||
      !Array.isArray(drop.extensions) || !drop.extensions.length || drop.extensions.length > 100 ||
      drop.extensions.some(extension => typeof extension !== 'string' || !/^\.[a-z0-9]{1,16}$/.test(extension)) ||
      new Set(drop.extensions).size !== drop.extensions.length ||
      !metadata.permissions?.includes('internal-view')) {
    throw new Error(`Provider ${metadata.id} has invalid file-drop metadata or permissions.`);
  }
}
