import type { AppMessages } from '../../../Common/IPC';
import { KAWAI_DOWNLOADER_APP_ID } from '../../../Common/Download';
import {
    type DistributionPreview,
    type ExternalAppDistributionApi,
} from '../../../Common/ExternalAppDistribution';
import { DistributionControls } from '../ExternalApps/DistributionControls';
import type {
    DownloaderMessages,
    KawaikaraVideoApi,
} from '../../../Common/IPC';
import { useEffect, useState } from 'react';
import { Button, Flex, Input, Stack, Text } from '@kawaikara/kawai-ui';
import type { ExternalDownloaderStatus } from '../../../Common/Download';
import { ExternalAppSetupPanel } from '../ExternalApps/ExternalAppSetupPanel';
import downloaderImage from '../../../../imgs/kawai-downloader.png';

/** Inputs shared by the Provider overlay and the legacy internal-video entry. */
export interface YouTubeDownloaderPanelProps {
    /** Provider-owned source; absent declarations never fall back to a different download host. */
    readonly distributionUrl?: string;
    /** Optional trusted distribution lookup; legacy Video can continue with its fixed adapter. */
    readonly distributionApi?: ExternalAppDistributionApi;
    /** Localized distribution controls supplied by the application shell. */
    readonly distributionLabels?: AppMessages['externalApps']['distribution'];
    /** Main-selected locale messages. */
    readonly labels: DownloaderMessages;
    /** Provider-approved URL retained through installation and retry. */
    readonly initialUrl?: string;
    /** Trusted preload API for the surface hosting this view. */
    readonly api?: KawaikaraVideoApi['downloads'];
    /** Whether the internal video entry may edit the requested URL. */
    readonly editableSource?: boolean;
    /** Dismisses the owning overlay; does not activate another Provider. */
    readonly onClose?: () => void;
}

/** Presents the bundled companion identity and local adapter status. No remote manifest executes here. */
export function YouTubeDownloaderPanel({
    distributionApi,
    distributionLabels,
    distributionUrl,
    initialUrl = '',
    labels,
    onClose,
    api = window.kawaikaraVideo.downloads,
    editableSource = true,
}: YouTubeDownloaderPanelProps) {
    const [status, setStatus] = useState<ExternalDownloaderStatus>();
    const [distributionFailed, setDistributionFailed] = useState(false);
    const [distributionLoading, setDistributionLoading] = useState(false);
    const [distribution, setDistribution] = useState<DistributionPreview>();
    useEffect(() => {
        if (!distributionApi || !distributionUrl || !status || status.installed) {
            setDistribution(undefined);
            setDistributionFailed(false);
            setDistributionLoading(false);
            return;
        }
        let active = true;
        setDistribution(undefined);
        setDistributionFailed(false);
        setDistributionLoading(true);
        void distributionApi
            .preview(distributionUrl, KAWAI_DOWNLOADER_APP_ID)
            .then((value) => {
                if (active) setDistribution(value);
            })
            .catch(() => {
                if (active) setDistributionFailed(true);
            })
            .finally(() => {
                if (active) setDistributionLoading(false);
            });
        return () => {
            active = false;
        };
    }, [distributionApi, distributionUrl, status?.development, status?.installed]);
    const [url, setUrl] = useState(initialUrl);
    const [error, setError] = useState<string>();
    const [installing, setInstalling] = useState(false);
    const [opening, setOpening] = useState(false);
    const [checking, setChecking] = useState(true);
    useEffect(() => {
        setUrl(initialUrl);
    }, [initialUrl]);
    useEffect(() => {
        let active = true;
        void api
            .getStatus()
            .then((next) => {
                if (active) setStatus(next);
            })
            .catch((reason: unknown) => {
                if (active) setError(getErrorMessage(reason));
            })
            .finally(() => {
                if (active) setChecking(false);
            });
        return () => {
            active = false;
        };
    }, [api]);

    /** Refreshes locally observed availability after the user installs or connects the app. */
    const refresh = async () => {
        setChecking(true);
        setError(undefined);
        try {
            const next = await api.getStatus();
            setStatus(next);
            if (!next.installed && distributionApi && distributionUrl) {
                try {
                    setDistributionFailed(false);
                    setDistribution(
                        await distributionApi.preview(
                            distributionUrl,
                            KAWAI_DOWNLOADER_APP_ID,
                        ),
                    );
                } catch {
                    setDistributionFailed(true);
                }
            }
        } catch (reason) {
            setError(getErrorMessage(reason));
        } finally {
            setChecking(false);
        }
    };
    /** Re-dispatches the retained URL through Main's existing permission checks. */
    const openDownloader = async () => {
        setOpening(true);
        setError(undefined);
        try {
            const result = await api.open(url);
            setStatus(result.status);
            if (result.opened) onClose?.();
            else
                setError(
                    result.failureCode === 'permission-denied'
                        ? labels.permissionDenied
                        : result.status.development
                        ? labels.developmentWaiting
                        : labels.missing,
                );
        } catch (reason) {
            setError(getErrorMessage(reason));
        } finally {
            setOpening(false);
        }
    };
    /** Uses the fixed built-in installer and its confirmation; presentation metadata cannot select commands. */
    const installDownloader = async () => {
        setInstalling(true);
        setError(undefined);
        try {
            const result = await api.install(url.trim() || undefined);
            setStatus(result.status);
            if (result.opened) onClose?.();
            else if (
                !result.canceled &&
                !result.status.installed &&
                !result.installerStarted
            )
                setError(result.status.message ?? labels.installFailed);
        } catch (reason) {
            setError(getErrorMessage(reason));
        } finally {
            setInstalling(false);
        }
    };
    /** Opens only the adapter's fixed release page and surfaces launch failures. */
    const openReleases = async () => {
        try {
            await api.openReleasePage();
        } catch (reason) {
            setError(getErrorMessage(reason));
        }
    };
    const installed = status?.installed ?? false;
    const busy = checking || installing || opening || distributionLoading;
    const statusLabel =
        checking || distributionLoading
            ? labels.checking
            : installing
              ? labels.installing
              : opening
                ? labels.opening
                : status?.development
                  ? installed
                      ? labels.developmentConnected
                      : labels.developmentWaiting
                  : installed
                    ? labels.installed
                    : labels.notInstalled;
    return (
        <ExternalAppSetupPanel
            app={{
                name: distribution?.descriptor.name ?? labels.title,
                image: distribution?.icon ?? downloaderImage,
            }}
            status={statusLabel}
            closeLabel={labels.close}
            onClose={onClose}>
            <Stack gap="md">
                <Text
                    className="external-app-setup-description"
                    size="sm"
                    tone="muted">
                    {labels.description}
                </Text>
                {status?.version ? (
                    <Text size="xs" tone="muted">
                        {labels.version} {status.version}
                    </Text>
                ) : null}
                {editableSource ? (
                    <Input
                        label={labels.url}
                        placeholder={labels.urlPlaceholder}
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                    />
                ) : null}
                {!installed &&
                status &&
                (!distribution && (status.development || editableSource)) ? (
                    <Text size="xs" tone="muted">
                        {status.development
                            ? labels.developmentHelp
                            : !status.automaticInstallSupported
                              ? labels.unsupported
                              : status.platform === 'darwin'
                                ? labels.macInstallHelp
                                : labels.windowsInstallHelp}
                    </Text>
                ) : null}
                {!installed &&
                status &&
                distribution &&
                distributionApi &&
                distributionLabels ? (
                    <DistributionControls
                        preview={distribution}
                        api={distributionApi}
                        labels={distributionLabels}
                        onChanged={() => void refresh()}
                    />
                ) : null}
                <Flex
                    className="external-app-setup-actions"
                    align="center"
                    justify="center"
                    gap="sm"
                    wrap>
                    {installed ? (
                        <Button
                            disabled={busy || !url.trim()}
                            isLoading={opening}
                            onClick={openDownloader}>
                            {labels.open}
                        </Button>
                    ) : status &&
                      !distribution &&
                      editableSource &&
                      !status.development &&
                      status.automaticInstallSupported ? (
                        <Button
                            disabled={busy}
                            isLoading={installing}
                            onClick={installDownloader}>
                            {labels.install}
                        </Button>
                    ) : null}
                    {status &&
                    !distribution &&
                    editableSource &&
                    !status.development &&
                    !installed ? (
                        <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={openReleases}>
                            {labels.releases}
                        </Button>
                    ) : null}
                    <Button
                        variant="secondary"
                        disabled={busy}
                        isLoading={checking}
                        onClick={refresh}>
                        {labels.refresh}
                    </Button>
                </Flex>
                {status?.message ? (
                    <Text size="xs" tone="muted">
                        {status.message}
                    </Text>
                ) : null}
                {distributionFailed && distributionLabels ? (
                    <Text role="alert" size="xs" tone="danger">
                        {distributionLabels.error}
                    </Text>
                ) : null}
                {error ? (
                    <div role="alert">
                        <Text size="xs" tone="danger">
                            {error}
                        </Text>
                    </div>
                ) : null}
            </Stack>
        </ExternalAppSetupPanel>
    );
}

/** Converts adapter failures to display text without changing their meaning. */
function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
