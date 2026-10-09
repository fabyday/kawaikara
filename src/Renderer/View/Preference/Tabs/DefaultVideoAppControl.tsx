import { Button, Flex, Panel, Stack, Text } from '@kawaikara/kawai-ui';
import { useState } from 'react';
import type { AppLocale, AppMessages } from '../../../../Common/IPC';

/** A platform capability-driven row; association ownership and consent stay outside Renderer. */
export function DefaultVideoAppControl({ enabled, disabled, locale, messages }: {
  /** Whether this is an installed Windows build. */
  readonly enabled: boolean;
  /** Whether preferences are being saved. */
  readonly disabled: boolean;
  /** Current locale for Main-resolved errors. */
  readonly locale: AppLocale;
  /** Main-resolved UI copy. */
  readonly messages: AppMessages['defaultVideoApp'];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  /** Prevents duplicate launches while the OS settings request is pending. */
  const openSettings = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await window.kawaikara.application.openDefaultVideoAppSettings(locale);
    } catch {
      setError(messages.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel padding="md" radius="md">
      <Stack gap="sm">
        <Flex align="center" justify="between" gap="md">
          <Text weight="semibold">{messages.title}</Text>
          <Button type="button" disabled={!enabled || disabled || busy} onClick={() => void openSettings()}>
            {messages.button}
          </Button>
        </Flex>
        <Text size="xs" tone="muted">{enabled ? messages.description : messages.unavailable}</Text>
        {error ? <Text role="alert" size="xs" tone="danger">{error}</Text> : null}
      </Stack>
    </Panel>
  );
}
