import { Box, KawaiProvider, Text } from '@kawaikara/kawai-ui';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { RendererMessages } from '../../../Common/IPC';
import type { LogViewerHostState } from '../../../Common/LogViewer';
import { LogViewer } from './App';

/** Main supplies appearance and translations; renderer only presents and accepts input. */
export function LogViewerWindowApp() {
  const [host, setHost] = useState<LogViewerHostState>();
  const [messages, setMessages] = useState<RendererMessages>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let alive = true;
    let sequence = 0;
    /** Keeps only the latest locale response when appearance changes overlap. */
    const update = async (state: LogViewerHostState) => {
      const request = ++sequence;
      if (!alive) return;
      // Native reparenting waits for painted frames. Commit drag/hit-test regions
      // synchronously so the first frame in the new host uses its actual layout.
      flushSync(() => setHost(state));
      try {
        const next = await window.kawaikara.application.getMessages(state.locale);
        if (alive && request === sequence) {
          setMessages(next);
          window.document.title = next.logViewer.title;
          window.document.documentElement.lang = next.locale;
          setError(undefined);
        }
      } catch (reason) { if (alive) setError(String(reason)); }
    };
    const remove = window.kawaikara.logViewer.onStateChanged((state) => { void update(state); });
    void window.kawaikara.logViewer.command('state').then(update).catch((reason) => {
      if (alive) setError(String(reason));
    });
    return () => { alive = false; remove(); };
  }, []);
  /** Reports native failures without discarding the current log document. */
  const command = (value: 'toggle' | 'close') => {
    void window.kawaikara.logViewer.command(value).catch((reason) => setError(String(reason)));
  };
  return (
    <KawaiProvider>
      <Box className={`log-viewer-window-root kawai-theme kawai-theme-${host?.theme ?? 'dark'}`}>
        {messages && host ? (
          <LogViewer messages={messages.logViewer} locale={messages.locale}
            detached={host.detached} onClose={() => command('close')}
            onToggleDetached={() => command('toggle')} />
        ) : null}
        {error ? <Text className="log-viewer-window-error" tone="danger">{error}</Text> : null}
      </Box>
    </KawaiProvider>
  );
}
