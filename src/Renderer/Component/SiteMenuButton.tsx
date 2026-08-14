import { Badge, Button } from '@kawaikara/kawai-ui';
import type { SiteMenuItem } from '../../Common/IPC';
import { SiteIcon } from './SiteIcon';

export interface SiteMenuButtonProps {
  readonly site: SiteMenuItem;
  readonly isSelected?: boolean;
  readonly selectedLabel: string;
  readonly onOpen: (id: string) => void | Promise<void>;
}

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
