import { useState } from 'react';
import type { SiteMenuItem } from '../../Common/IPC';

export interface SiteIconProps {
  readonly site: Pick<SiteMenuItem, 'title' | 'icon'>;
}

export interface SiteIconCacheProps {
  readonly sites: readonly Pick<SiteMenuItem, 'id' | 'title' | 'icon'>[];
}

/**
 * Keep one decoded image element alive while the overlay renderer is running.
 * The visible menu is intentionally unmounted after its close animation, but
 * these retained elements prevent remote favicons from flashing blank when it
 * is opened again with Tab.
 */
export function SiteIconCache({ sites }: SiteIconCacheProps) {
  const icons = new Map<string, Pick<SiteMenuItem, 'id' | 'title' | 'icon'>>();
  for (const site of sites) {
    if (site.icon && !icons.has(site.icon)) icons.set(site.icon, site);
  }

  return (
    <div aria-hidden="true" className="site-icon-cache">
      {[...icons.values()].map((site) => (
        <img
          alt=""
          decoding="async"
          key={`${site.id}:${site.icon}`}
          src={site.icon}
        />
      ))}
    </div>
  );
}

export function SiteIcon({ site }: SiteIconProps) {
  const [failed, setFailed] = useState(false);

  if (!site.icon || failed) {
    return (
      <span aria-hidden="true" className="site-icon site-icon-fallback">
        {site.title.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      alt=""
      className="site-icon"
      decoding="sync"
      src={site.icon}
      onError={() => setFailed(true)}
    />
  );
}
