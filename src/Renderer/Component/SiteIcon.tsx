import { useState } from 'react';
import type { SiteMenuItem } from '../../Common/IPC';

export interface SiteIconProps {
  readonly site: Pick<SiteMenuItem, 'title' | 'icon'>;
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
      src={site.icon}
      onError={() => setFailed(true)}
    />
  );
}
