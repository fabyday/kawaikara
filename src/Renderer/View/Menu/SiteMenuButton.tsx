import { Button } from '@kawaikara/kawai-ui';
import type { SiteMenuItem } from '../../../Common/IPC';
import { SiteIcon } from '../../Component/SiteIcon';
import { ShortcutKeycaps } from '../../Component/ShortcutKeycaps';

/** Describes the site menu button props contract. */
export interface SiteMenuButtonProps {
  /** The site value. */
  readonly site: SiteMenuItem;
  /** Whether the selected option is enabled. */
  readonly isSelected?: boolean;
  /** The shortcut displayed at the trailing edge. */
  readonly shortcut: string;
  /** Temporary Kawai Shortcut key within the active category. */
  readonly kawaiShortcutKey?: string;
  /** Callback used to handle on open. */
  readonly onOpen: (id: string) => void | Promise<void>;
}

/** Performs the site menu button operation. */
export function SiteMenuButton({
  site,
  isSelected = false,
  shortcut,
  kawaiShortcutKey,
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
      <ShortcutKeycaps
        accelerator={kawaiShortcutKey === undefined
          ? shortcut
          : kawaiShortcutKey}
        className={`site-shortcut-keycaps${kawaiShortcutKey === undefined
          ? ''
          : ' is-kawai-target'}`}
      />
    </Button>
  );
}
