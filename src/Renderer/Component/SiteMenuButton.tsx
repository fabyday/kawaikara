import { Badge, Button } from '@kawaikara/kawai-ui';
import type { SiteMenuItem } from '../../Common/IPC';
import { SiteIcon } from './SiteIcon';

/** Describes the site menu button props contract. */
export interface SiteMenuButtonProps {
  /** The site value. */
  readonly site: SiteMenuItem;
  /** Whether the selected option is enabled. */
  readonly isSelected?: boolean;
  /** The selected label value. */
  readonly selectedLabel: string;
  /** Callback used to handle on open. */
  readonly onOpen: (id: string) => void | Promise<void>;
}

/** Performs the site menu button operation. */
export function SiteMenuButton({
  site,
  isSelected = false,
  selectedLabel,
  onOpen,
}: SiteMenuButtonProps) {
  return (
    <Button
      className="site-button"
      fullWidth
      aria-current={isSelected ? 'true' : undefined}
      variant={isSelected ? 'secondary' : 'ghost'}
      onClick={() => void onOpen(site.id)}
    >
      <SiteIcon site={site} />
      <span>{site.title}</span>
      {isSelected ? (
        <Badge className="selected-site-badge" size="sm" tone="primary" dot>
          {selectedLabel}
        </Badge>
      ) : null}
    </Button>
  );
}
