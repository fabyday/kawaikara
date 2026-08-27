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
  /** The initial URL value. */
  readonly initialUrl?: string;
  /** Callback used to handle on close. */
  readonly onClose?: () => void;
}

/** Performs the you tube downloader panel operation. */
export function YouTubeDownloaderPanel({
  initialUrl = '',
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
        setError('YT Downloader가 설치되어 있지 않습니다.');
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
        setError(result.status.message ?? 'YT Downloader를 설치하지 못했습니다.');
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
      ? 'Installed'
      : 'Not installed'
    : 'Checking';

  return (
    <Panel className="youtube-downloader-panel" padding="md" radius="lg">
      <Stack gap="md">
        <Flex align="center" justify="between" gap="md">
          <Stack gap="xs">
            <Flex align="center" gap="sm">
              <Text weight="semibold">YT Downloader</Text>
              <Badge dot size="sm" tone={installed ? 'success' : 'neutral'}>
                {statusLabel}
              </Badge>
            </Flex>
            <Text size="xs" tone="muted">
              다운로드 화면은 별도 앱에서 열립니다.
            </Text>
          </Stack>
          {onClose ? (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </Flex>

        {status?.version ? (
          <Text size="xs" tone="muted">
            Version {status.version} · {status.appPath ?? 'protocol installation'}
          </Text>
        ) : null}

        <Input
          label="YouTube URL"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />

        {installed ? (
          <Button
            disabled={!url.trim() || opening}
            isLoading={opening}
            onClick={openDownloader}
          >
            Open in YT Downloader
          </Button>
        ) : (
          <Stack gap="sm">
            <Text size="xs" tone="muted">
              {status?.platform === 'darwin'
                ? '설치를 누르면 공식 릴리스를 받고 SHA-256을 확인합니다. 확인 창에서 동의하면 다운로드한 파일과 설치 앱의 macOS 격리 속성을 제거하고 ~/Applications에 설치합니다.'
                : '설치를 누르면 공식 릴리스를 받고 SHA-256을 확인한 뒤 설치 프로그램을 엽니다.'}
            </Text>
            <Flex align="center" gap="sm">
              <Button
                disabled={!status?.automaticInstallSupported || installing}
                isLoading={installing}
                onClick={installDownloader}
              >
                Install YT Downloader
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  void window.kawaikaraVideo.downloads.openReleasePage()
                }
              >
                Open releases
              </Button>
            </Flex>
          </Stack>
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
          Download only content you own or are permitted to save.
        </Text>
      </Stack>
    </Panel>
  );
}

/** Returns the error message. */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
