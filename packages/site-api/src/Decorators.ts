import type {
  SiteDescriptorConstructor,
  SiteMetadata,
} from './SiteDescriptor';

const SITE_METADATA = Symbol.for('@kawaikara/site-api/site-metadata');

export function site(metadata: SiteMetadata) {
  return <T extends SiteDescriptorConstructor>(target: T): T => {
    if (!metadata.id.trim()) {
      throw new Error('A site descriptor must have a non-empty id.');
    }

    Object.defineProperty(target, SITE_METADATA, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({ ...metadata }),
    });

    return target;
  };
}

export function getSiteMetadata(
  target: SiteDescriptorConstructor,
): SiteMetadata | undefined {
  return (target as unknown as Record<symbol, SiteMetadata>)[SITE_METADATA];
}
