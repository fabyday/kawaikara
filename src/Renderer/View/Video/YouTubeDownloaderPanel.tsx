import type { DownloaderMessages } from '../../../Common/IPC';
import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Flex,
  Input,
  Panel,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import type { ExternalDownloaderStatus } from '../../../Common/Download';

/** Describes the you tube downloader panel props contract. */
export interface YouTubeDownloaderPanelProps {
  /** Copy selected by Main. */
  readonly labels: DownloaderMessages;
  /** The initial URL value. */
  readonly initialUrl?: string;
  /** Callback used to handle on close. */
  readonly onClose?: () => void;
}

/** Performs the you tube downloader panel operation. */
export function YouTubeDownloaderPanel({
  initialUrl = '',
  labels,
  onClose,
}: YouTubeDownloaderPanelProps) {
  const [url, setUrl] = useState(initialUrl);
  const [status, setStatus] = useState<ExternalDownloaderStatus>();
  const [error, setError] = useState<string>();
  const [installing, setInstalling] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    let active = true;
    void window.kawaikaraVideo.downloads
      .getStatus()
      .then((nextStatus) => {
        if (active) setStatus(nextStatus);
      })
      .catch((reason: unknown) => {
        if (active) setError(getErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  /** Opens the downloader. */
  const openDownloader = async () => {
    setOpening(true);
    setError(undefined);
    try {
      const result = await window.kawaikaraVideo.downloads.open(url);
      setStatus(result.status);
      if (!result.opened) {
        setError(labels.missing);
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setOpening(false);
    }
  };

  /** Installs the downloader. */
  const installDownloader = async () => {
    setInstalling(true);
    setError(undefined);
    try {
      const result = await window.kawaikaraVideo.downloads.install(
        url.trim() || undefined,
      );
      setStatus(result.status);
      if (!result.canceled && !result.status.installed && !result.installerStarted) {
        setError(result.status.message ?? labels.installFailed);
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setInstalling(false);
    }
  };

  const installed = status?.installed ?? false;
  const statusLabel = status
    ? installed
      ? labels.installed
      : labels.notInstalled
    : labels.checking;

  return (
    <Panel className="youtube-downloader-panel" padding="md" radius="lg">
      <Stack gap="md">
        <DownloaderHeader
          labels={labels}
          onClose={onClose}
          installed={installed}
          statusLabel={statusLabel}
        />

        {status?.version ? (
          <Text size="xs" tone="muted">
            {labels.version} {status.version} · {status.appPath ?? labels.protocolInstallation}
          </Text>
        ) : null}

        <Input
          label={labels.url}
          placeholder={labels.urlPlaceholder}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />

        {installed ? (
          <Button
            disabled={!url.trim() || opening}
            isLoading={opening}
            onClick={openDownloader}
          >
            {labels.open}
          </Button>
        ) : (
          <DownloaderInstallActions
            labels={labels}
            status={status}
            installing={installing}
            installDownloader={installDownloader}
          />
        )}

        {status?.message ? (
          <Text size="xs" tone={installed ? 'primary' : 'muted'}>
            {status.message}
          </Text>
        ) : null}
        {error ? (
          <Text size="xs" tone="danger">
            {error}
          </Text>
        ) : null}

        <Text size="xs" tone="muted">
          {labels.permissionNotice}
        </Text>
      </Stack>
    </Panel>
  );
}

/** Returns the error message. */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Downloader identity, installation status, and close action. */
function DownloaderHeader({
  labels,
  onClose,
  installed,
  statusLabel,
}: Pick<YouTubeDownloaderPanelProps, 'labels' | 'onClose'> & {
  /** installed supplied by the owning composition. */
  readonly installed: boolean;
  /** statusLabel supplied by the owning composition. */
  readonly statusLabel: string;
}) {
  return (
    <Flex align="center" justify="between" gap="md">
      <Stack gap="xs">
        <Flex align="center" gap="sm">
          <Text weight="semibold">{labels.title}</Text>
          <Badge dot size="sm" tone={installed ? 'success' : 'neutral'}>
            {statusLabel}
          </Badge>
        </Flex>
        <Text size="xs" tone="muted">
          {labels.description}
        </Text>
      </Stack>
      {onClose ? (
        <Button size="sm" variant="ghost" onClick={onClose}>
          {labels.close}
        </Button>
      ) : null}
    </Flex>
  );
}

/** Platform-specific installation guidance and explicit install/release actions. */
function DownloaderInstallActions({
  labels,
  status,
  installing,
  installDownloader,
}: Pick<YouTubeDownloaderPanelProps, 'labels'> & {
  /** status supplied by the owning composition. */
  readonly status: ExternalDownloaderStatus | undefined;
  /** installing supplied by the owning composition. */
  readonly installing: boolean;
  /** installDownloader supplied by the owning composition. */
  readonly installDownloader: () => Promise<void>;
}) {
  return (
    <Stack gap="sm">
      <Text size="xs" tone="muted">
        {status?.platform === 'darwin'
          ? labels.macInstallHelp
          : labels.windowsInstallHelp}
      </Text>
      <Flex align="center" gap="sm">
        <Button
          disabled={!status?.automaticInstallSupported || installing}
          isLoading={installing}
          onClick={installDownloader}
        >
          {labels.install}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void window.kawaikaraVideo.downloads.openReleasePage()
          }
        >
          {labels.releases}
        </Button>
      </Flex>
    </Stack>
  );
}
