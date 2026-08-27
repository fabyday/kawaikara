import { useEffect, useMemo, useState } from 'react';
import type {
  PluginViewPanelInfo,
  VideoLibraryMessages,
} from '../../../Common/IPC';
import type { ProviderLocalizedText } from '@kawaikara/site-api';
import { VideoLibraryMenuPanel } from './VideoLibraryMenuPanel';

/** Describes the plugin view host props contract. */
interface PluginViewHostProps {
  /** The locale value. */
  readonly locale: string;
  /** The panels value. */
  readonly panels: readonly PluginViewPanelInfo[];
  /** The refresh key value. */
  readonly refreshKey: number;
  /** The video library labels value. */
  readonly videoLibraryLabels: VideoLibraryMessages;
  /** Callback used to handle on error. */
  readonly onError: (message: string) => void;
}

/** Performs the plugin view host operation. */
export function PluginViewHost({
  locale,
  panels,
  refreshKey,
  videoLibraryLabels,
  onError,
}: PluginViewHostProps) {
  const orderedPanels = useMemo(
    () => [...panels].sort((left, right) =>
      left.order - right.order || left.id.localeCompare(right.id)),
    [panels],
  );
  const [selectedPanelId, setSelectedPanelId] = useState(
    orderedPanels[0]?.id,
  );

  useEffect(() => {
    setSelectedPanelId((current) =>
      current && orderedPanels.some(({ id }) => id === current)
        ? current
        : orderedPanels[0]?.id,
    );
  }, [orderedPanels]);

  const selectedPanel = orderedPanels.find(({ id }) => id === selectedPanelId)
    ?? orderedPanels[0];
  if (!selectedPanel) return null;

  return (
    <section className="plugin-view-host">
      {orderedPanels.length > 1 ? (
        <div aria-label="Plugin panels" className="plugin-view-tabs" role="tablist">
          {orderedPanels.map((panel) => (
            <button
              aria-selected={panel.id === selectedPanel.id}
              className={panel.id === selectedPanel.id ? 'is-active' : undefined}
              key={panel.id}
              role="tab"
              type="button"
              onClick={() => setSelectedPanelId(panel.id)}
            >
              {resolveLocalizedText(panel.title, locale)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="plugin-view-content" role="tabpanel">
        <PluginViewPanel
          key={selectedPanel.id}
          labels={videoLibraryLabels}
          panel={selectedPanel}
          refreshKey={refreshKey}
          title={resolveLocalizedText(selectedPanel.title, locale)}
          onError={onError}
        />
      </div>
    </section>
  );
}

/** Performs the plugin view panel operation. */
function PluginViewPanel({
  labels,
  panel,
  refreshKey,
  title,
  onError,
}: {
  /** The labels value. */
  readonly labels: VideoLibraryMessages;
  /** The panel value. */
  readonly panel: PluginViewPanelInfo;
  /** The refresh key value. */
  readonly refreshKey: number;
  /** The title value. */
  readonly title: string;
  /** Callback used to handle on error. */
  readonly onError: (message: string) => void;
}
) {
  if (panel.content.kind === 'html') {
    return (
      <iframe
        className="plugin-view-frame"
        sandbox="allow-forms allow-scripts"
        srcDoc={panel.content.html}
        title={title}
      />
    );
  }
  if (panel.content.viewId === 'video-library') {
    return (
      <VideoLibraryMenuPanel
        labels={labels}
        refreshKey={refreshKey}
        onError={onError}
      />
    );
  }
  return <div className="plugin-view-unsupported">Unknown panel: {title}</div>;
}

/** Resolves the localized text. */
function resolveLocalizedText(
  value: ProviderLocalizedText,
  locale: string,
): string {
  if (typeof value === 'string') return value;
  if (value[locale]) return value[locale];
  const language = locale.split('-')[0];
  return Object.entries(value).find(([key]) =>
    key.split('-')[0] === language)?.[1]
    ?? value['en-US']
    ?? Object.values(value)[0]
    ?? '';
}
