import { Button, Flex, Input, Panel, Stack, Text } from '@kawaikara/kawai-ui';
import { useEffect, useState } from 'react';
import type { AppLocale, AppMessages, ApplicationDataLocation, PreferenceState } from '../../../../Common/IPC';

/** Edits a next-launch path only; Main owns validation, folder selection and confirmation. */
export function AppDataLocationControl({ location, messages, locale, saving, onSavePreferences }: {
  /** Omitted by Main on macOS. */
  readonly location: ApplicationDataLocation;
  /** Main-resolved copy. */
  readonly messages: AppMessages['appDataLocation'];
  /** Draft locale used by native dialogs. */
  readonly locale: AppLocale;
  /** Other preference work is active. */
  readonly saving: boolean;
  /** Flush pending ordinary settings before a confirmed restart. */
  readonly onSavePreferences: () => Promise<PreferenceState | undefined>;
}) {
  const [directory, setDirectory] = useState(location.currentPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [restarting, setRestarting] = useState(false);
  useEffect(() => setDirectory(location.currentPath), [location.currentPath]);
  const disabled = saving || busy || restarting || !location.canChange;
  /** Keep cancellation separate from an empty path. */
  const browse = async () => {
    setBusy(true); setError(undefined);
    try {
      const selected = await window.kawaikara.data.selectLocation(locale);
      if (selected !== undefined) setDirectory(selected);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  /** Applying is explicit because changing UserRoot requires a fresh process. */
  const apply = async () => {
    setBusy(true); setError(undefined);
    try {
      if (!(await onSavePreferences())) return;
      const result = await window.kawaikara.data.changeLocation(directory, locale);
      setRestarting(result.status === 'restarting');
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return (
    <Panel padding="md" radius="md">
      <Stack gap="sm">
        <Flex className="app-data-path-row" align="center" gap="sm">
          <Text as="span" id="preference-app-data-path-label" weight="semibold">{messages.label}</Text>
          <Input id="preference-app-data-path" aria-labelledby="preference-app-data-path-label" containerClassName="app-data-path-input" value={directory}
            disabled={disabled} spellCheck={false} onChange={event => {setDirectory(event.target.value);setError(undefined);}} />
          <Button variant="secondary" disabled={disabled} onClick={() => void browse()}>{messages.browse}</Button>
        </Flex>
        <Text size="xs" tone="muted">{messages.hint}</Text>
        <Text size="xs" tone="danger">{messages.warning}</Text>
        <Text size="xs" tone="muted">{messages.builtin}</Text>
        {!location.canChange ? <Text size="xs" tone="muted">{messages.unavailable}</Text> : null}
        {error ? <Text role="alert" size="sm" tone="danger">{error}</Text> : null}
        <Flex justify="end">
          <Button disabled={disabled || !directory.trim() || directory.trim() === location.currentPath} onClick={() => void apply()}>
            {restarting ? messages.restarting : messages.apply}
          </Button>
        </Flex>
      </Stack>
    </Panel>
  );
}
