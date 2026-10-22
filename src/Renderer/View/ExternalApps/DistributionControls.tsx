import { useEffect, useRef, useState } from 'react';
import { Button, Flex, Input, Stack, Text } from '@kawaikara/kawai-ui';
import type { AppMessages } from '../../../Common/IPC';
import type {
    DistributionPreview,
    ExternalAppDistributionApi,
} from '../../../Common/ExternalAppDistribution';
import { ExternalAppSetupPanel } from './ExternalAppSetupPanel';

/** OS-selected actions shared by manual manifest previews and Provider requirement cards. */
export function DistributionControls({
    preview,
    api,
    labels,
    onChanged,
}: {
    /** Immutable Main-selected target and source. */
    readonly preview: DistributionPreview;
    /** Trusted application preload, never a Provider API. */
    readonly api: ExternalAppDistributionApi;
    /** App locale strings. */
    readonly labels: AppMessages['externalApps']['distribution'];
    /** Refreshes local installation state after a completed native handoff. */
    readonly onChanged?: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const locked = useRef(false);
    const [notice, setNotice] = useState('');
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        setFailed(false);
        setNotice('');
    }, [preview.token]);
    const guide =
        preview.target?.guideUrl ??
        preview.descriptor.guideUrl ??
        preview.descriptor.homepage;
    const connection =
        preview.target?.connection ?? preview.descriptor.connection;
    /** Uses only a preview capability; arbitrary URLs or commands cannot cross this call. */
    const act = async (
        action: Parameters<ExternalAppDistributionApi['act']>[1],
    ) => {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setFailed(false);
        setNotice('');
        try {
            const result = await api.act(preview.token, action);
            if (result === 'installer-opened')
                setNotice(labels.installerOpened);
            if (result === 'installed') setNotice(labels.testInstalled);
            if (result === 'downloaded') setNotice(labels.downloaded);
            if (result === 'installer-opened' || result === 'downloaded' || result === 'installed')
                onChanged?.();
        } catch {
            setFailed(true);
        } finally {
            locked.current = false;
            setBusy(false);
        }
    };
    return (
        <Stack gap="sm">
            {preview.target?.version && (
                <Text size="sm">
                    {labels.version}: {preview.target.version} ·{' '}
                    {preview.target.os} / {preview.target.arch}
                </Text>
            )}
            {preview.cached && (
                <Text size="xs" tone="muted">
                    {labels.cached}
                </Text>
            )}
            {preview.action === 'unsupported' && (
                <Text size="sm">{labels.unsupported}</Text>
            )}
            <Flex gap="sm" wrap justify="center">
                {preview.action === 'install' && (
                    <Button
                        disabled={busy}
                        isLoading={busy}
                        onClick={() => void act('install')}>
                        {labels.install}
                    </Button>
                )}
                {preview.action === 'download' && preview.target?.artifact && (
                    <Button
                        disabled={busy}
                        isLoading={busy}
                        onClick={() => void act('download')}>
                        {labels.download}
                    </Button>
                )}
                {guide && (
                    <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void act('guide')}>
                        {labels.guide}
                    </Button>
                )}
                {connection?.guideUrl && (
                    <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void act('connection-guide')}>
                        {labels.connectionGuide}
                    </Button>
                )}
            </Flex>
            <Text size="xs" tone="muted">
                {labels.installationHelp}
            </Text>
            {notice && (
                <Text role="status" size="sm">
                    {notice}
                </Text>
            )}
            {failed && (
                <Text role="alert" tone="danger" size="sm">
                    {labels.actionError}
                </Text>
            )}
        </Stack>
    );
}

/** Explicit public-manifest lookup in settings; viewing data never registers an external app. */
export function DistributionLookup({
    labels,
}: {
    /** Localized controls supplied by the settings view. */
    readonly labels: AppMessages['externalApps']['distribution'];
}) {
    const [url, setUrl] = useState('');
    const [preview, setPreview] = useState<DistributionPreview>();
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const request = useRef(0);
    /** Resolves one current URL and ignores superseded responses. */
    const lookup = async () => {
        if (busy || !url.trim()) return;
        const current = ++request.current;
        setBusy(true);
        setFailed(false);
        try {
            const result = await window.kawaikara.appDistribution.preview(
                url.trim(),
            );
            if (current === request.current) setPreview(result);
        } catch {
            if (current === request.current) setFailed(true);
        } finally {
            if (current === request.current) setBusy(false);
        }
    };
    return (
        <Stack gap="sm">
            <Text size="sm" weight="semibold">
                {labels.title}
            </Text>
            <Text size="xs" tone="muted">
                {labels.help}
            </Text>
            <Flex align="end" gap="sm" wrap>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <Input
                        label={labels.url}
                        disabled={busy}
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') void lookup();
                        }}
                    />
                </div>
                <Button
                    variant="secondary"
                    disabled={busy || !url.trim()}
                    isLoading={busy}
                    onClick={() => void lookup()}>
                    {labels.preview}
                </Button>
            </Flex>
            {failed && (
                <Text role="alert" size="sm" tone="danger">
                    {labels.error}
                </Text>
            )}
            {preview && (
                <ExternalAppSetupPanel
                    app={{ name: preview.descriptor.name, image: preview.icon }}
                    status={
                        preview.action === 'unsupported'
                            ? labels.unsupported
                            : preview.action === 'guide'
                              ? labels.guide
                              : labels.available
                    }
                    closeLabel={labels.close}
                    onClose={() => setPreview(undefined)}>
                    <DistributionControls
                        preview={preview}
                        api={window.kawaikara.appDistribution}
                        labels={labels}
                    />
                </ExternalAppSetupPanel>
            )}
        </Stack>
    );
}
