import {
  Badge,
  Button,
  Flex,
  Head,
  Panel,
  Progress,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import { useEffect, useState } from 'react';
import type {
  ApplicationUpdatePanelState,
  AppLocale,
} from '../../../Common/IPC';
import kawaikaraImage from '../../../../imgs/kawaikara_banner2.png';

/** Describes the update panel props contract. */
export interface UpdatePanelProps {
  /** The state value. */
  readonly state: ApplicationUpdatePanelState;
  /** The locale value. */
  readonly locale?: AppLocale | string;
  /** Callback used to handle on dismiss. */
  readonly onDismiss: () => void;
  /** Callback used to handle on download. */
  readonly onDownload: () => void | Promise<void>;
  /** Callback used to handle on install. */
  readonly onInstall: () => void | Promise<void>;
  /** Callback used to handle on retry. */
  readonly onRetry: () => void | Promise<void>;
  /** The initial view value. */
  readonly initialView?: 'status' | 'release-notes';
  /** The view value. */
  readonly view?: 'status' | 'release-notes';
  /** Callback used to handle on view change. */
  readonly onViewChange?: (view: 'status' | 'release-notes') => void;
}

/** Updates the panel. */
export function UpdatePanel({
  state,
  locale = 'en-US',
  onDismiss,
  onDownload,
  onInstall,
  onRetry,
  initialView = 'status',
  view: controlledView,
  onViewChange,
}: UpdatePanelProps) {
  const [internalView, setInternalView] = useState(initialView);
  const view = controlledView ?? internalView;
  const labels = getUpdatePanelLabels(locale);
  const copy = getPhaseCopy(state, labels);
  const progress = getProgressValue(state);
  const notes = selectLocalizedReleaseNotes(state.releaseNotes, locale)
    || labels.noReleaseNotes;
  const releaseIdentity = `${state.channel}:${state.latestVersion ?? state.currentVersion}`;
  const canShowReleaseNotes = Boolean(state.releaseNotes?.trim()) && [
    'available',
    'downloading',
    'downloaded',
  ].includes(state.phase);

  useEffect(() => {
    if (controlledView === undefined) setInternalView(initialView);
  }, [controlledView, initialView, releaseIdentity]);

  /** Sets the view. */
  const setView = (nextView: 'status' | 'release-notes') => {
    if (controlledView === undefined) setInternalView(nextView);
    onViewChange?.(nextView);
  };

  if (view === 'release-notes' && canShowReleaseNotes) {
    return (
      <UpdateReleaseNotesView
        labels={labels}
        notes={notes}
        state={state}
        onBack={() => setView('status')}
      />
    );
  }

  return (
    <main className={`update-shell is-${state.origin}`}>
      <Panel className="update-panel" padding="lg" radius="lg">
        <Stack align="center" gap="md">
          <img
            alt=""
            className="update-kawaikara-image"
            src={kawaikaraImage}
          />

          <Stack className="update-heading" align="center" gap="xs">
            <Badge dot tone={state.phase === 'error' ? 'neutral' : 'primary'}>
              {labels.channel}: {formatChannel(state.channel, labels)}
            </Badge>
            <Head level={1} size="lg">{copy.title}</Head>
            <Text size="sm" tone="muted">{copy.description}</Text>
          </Stack>

          <Stack className="update-progress-block" gap="sm">
            <Progress aria-label={copy.title} value={progress} />
            <Flex className="update-progress-meta" align="start" justify="between" gap="sm">
              <Text className="update-version-summary" size="xs" tone="muted">
                {versionSummary(state, labels)}
              </Text>
              {state.phase === 'downloading' && state.progress ? (
                <Text className="update-progress-summary" size="xs" tone="muted">
                  {formatProgress(state.progress.percent)}
                  {state.progress.total > 0
                    ? ` · ${formatBytes(state.progress.transferred)} / ${formatBytes(state.progress.total)}`
                    : ''}
                </Text>
              ) : null}
            </Flex>
          </Stack>

          {state.error ? (
            <Text className="update-error-message" size="sm">
              {state.error}
            </Text>
          ) : null}

          {canShowReleaseNotes ? (
            <Button
              className="update-release-notes-button"
              variant="secondary"
              onClick={() => setView('release-notes')}
            >
              <span>{labels.releaseNotes}</span>
              <span aria-hidden="true">→</span>
            </Button>
          ) : null}

          <UpdateActions
            labels={labels}
            origin={state.origin}
            phase={state.phase}
            onDismiss={onDismiss}
            onDownload={onDownload}
            onInstall={onInstall}
            onRetry={onRetry}
          />
        </Stack>
      </Panel>
    </main>
  );
}

/** Describes the update panel labels contract. */
interface UpdatePanelLabels {
  /** The channel value. */
  readonly channel: string;
  /** The stable value. */
  readonly stable: string;
  /** The staging value. */
  readonly staging: string;
  /** The nightly value. */
  readonly nightly: string;
  /** The checking title value. */
  readonly checkingTitle: string;
  /** The checking description value. */
  readonly checkingDescription: string;
  /** Whether the available title option is enabled. */
  readonly availableTitle: string;
  /** Whether the available description option is enabled. */
  readonly availableDescription: string;
  /** The downloading title value. */
  readonly downloadingTitle: string;
  /** The downloading description value. */
  readonly downloadingDescription: string;
  /** The downloaded title value. */
  readonly downloadedTitle: string;
  /** The downloaded description value. */
  readonly downloadedDescription: string;
  /** The automatic restart description value. */
  readonly automaticRestartDescription: string;
  /** The current title value. */
  readonly currentTitle: string;
  /** The current description value. */
  readonly currentDescription: string;
  /** The unsupported title value. */
  readonly unsupportedTitle: string;
  /** The unsupported description value. */
  readonly unsupportedDescription: string;
  /** The error title value. */
  readonly errorTitle: string;
  /** The error description value. */
  readonly errorDescription: string;
  /** The release notes value. */
  readonly releaseNotes: string;
  /** The no release notes value. */
  readonly noReleaseNotes: string;
  /** The current version value. */
  readonly currentVersion: string;
  /** The next version value. */
  readonly nextVersion: string;
  /** The download value. */
  readonly download: string;
  /** The restart value. */
  readonly restart: string;
  /** The retry value. */
  readonly retry: string;
  /** The close value. */
  readonly close: string;
  /** The later value. */
  readonly later: string;
  /** The back value. */
  readonly back: string;
  /** The release notes description value. */
  readonly releaseNotesDescription: string;
}

/** Updates the release notes view. */
function UpdateReleaseNotesView({
  labels,
  notes,
  state,
  onBack,
}: {
  /** The labels value. */
  readonly labels: UpdatePanelLabels;
  /** The notes value. */
  readonly notes: string;
  /** The state value. */
  readonly state: ApplicationUpdatePanelState;
  /** Callback used to handle on back. */
  readonly onBack: () => void;
}
) {
  return (
    <main className={`update-shell is-${state.origin}`}>
      <Panel
        className="update-panel update-release-notes-panel"
        padding="lg"
        radius="lg"
      >
        <div className="update-release-notes-layout">
          <Flex className="update-release-notes-header" align="center" gap="md">
            <Button aria-label={labels.back} variant="ghost" onClick={onBack}>
              <span aria-hidden="true">←</span>
            </Button>
            <Stack gap="xs">
              <Head level={1} size="lg">{labels.releaseNotes}</Head>
              <Text size="sm" tone="muted">
                {labels.releaseNotesDescription}
              </Text>
            </Stack>
          </Flex>

          <Flex className="update-release-notes-meta" align="center" gap="sm">
            <Badge dot tone="primary">
              {labels.channel}: {formatChannel(state.channel, labels)}
            </Badge>
            <Text size="xs" tone="muted">
              {versionSummary(state, labels)}
            </Text>
          </Flex>

          <section
            className="update-release-notes-scroll"
            aria-label={labels.releaseNotes}
          >
            <ReleaseNotesContent notes={notes} />
          </section>
        </div>
      </Panel>
    </main>
  );
}

/** Performs the release notes content operation. */
function ReleaseNotesContent({ notes }: {
  /** The notes value. */
  readonly notes: string;
}
) {
  return (
    <div className="update-release-notes-copy">
      {notes.split(/\r?\n/).map((line, index) => {
        const trimmed = line.trim();
        const heading = /^#{1,6}\s+(.+)$/.exec(trimmed);
        if (heading) return <h2 key={index}>{plainMarkdown(heading[1])}</h2>;
        const bullet = /^[-*+]\s+(.+)$/.exec(trimmed);
        if (bullet) {
          return (
            <div className="update-release-note-bullet" key={index}>
              <span aria-hidden="true">•</span>
              <span>{plainMarkdown(bullet[1])}</span>
            </div>
          );
        }
        if (!trimmed || /^-{3,}$/.test(trimmed)) {
          return <div className="update-release-note-space" key={index} />;
        }
        return <p key={index}>{plainMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

/** Updates the actions. */
function UpdateActions({
  labels,
  origin,
  phase,
  onDismiss,
  onDownload,
  onInstall,
  onRetry,
}: {
  /** The labels value. */
  readonly labels: UpdatePanelLabels;
  /** The origin value. */
  readonly origin: ApplicationUpdatePanelState['origin'];
  /** The phase value. */
  readonly phase: ApplicationUpdatePanelState['phase'];
  /** Callback used to handle on dismiss. */
  readonly onDismiss: () => void;
  /** Callback used to handle on download. */
  readonly onDownload: () => void | Promise<void>;
  /** Callback used to handle on install. */
  readonly onInstall: () => void | Promise<void>;
  /** Callback used to handle on retry. */
  readonly onRetry: () => void | Promise<void>;
}
) {
  if (phase === 'available') {
    return (
      <Flex className="update-actions" align="center" justify="end" gap="sm">
        <Button variant="ghost" onClick={onDismiss}>{labels.later}</Button>
        <Button onClick={() => void onDownload()}>{labels.download}</Button>
      </Flex>
    );
  }
  if (phase === 'downloaded') {
    if (origin === 'automatic') return null;
    return (
      <Flex className="update-actions" align="center" justify="end" gap="sm">
        <Button variant="ghost" onClick={onDismiss}>{labels.later}</Button>
        <Button onClick={() => void onInstall()}>{labels.restart}</Button>
      </Flex>
    );
  }
  if (phase === 'error') {
    return (
      <Flex className="update-actions" align="center" justify="end" gap="sm">
        <Button variant="ghost" onClick={onDismiss}>{labels.close}</Button>
        <Button variant="secondary" onClick={() => void onRetry()}>
          {labels.retry}
        </Button>
      </Flex>
    );
  }
  return (
    <Flex className="update-actions" align="center" justify="end">
      <Button
        disabled={phase === 'checking'}
        variant="secondary"
        onClick={onDismiss}
      >
        {phase === 'downloading' ? labels.later : labels.close}
      </Button>
    </Flex>
  );
}

/** Returns the progress value. */
function getProgressValue(state: ApplicationUpdatePanelState): number | null {
  if (state.phase === 'checking') return null;
  if (state.phase === 'downloading') return state.progress?.percent ?? 0;
  if (state.phase === 'downloaded' || state.phase === 'up-to-date') return 100;
  return 0;
}

/** Returns the phase copy. */
function getPhaseCopy(
  state: ApplicationUpdatePanelState,
  labels: UpdatePanelLabels,
) {
  switch (state.phase) {
    case 'checking':
      return {
        /** The title value. */
        title: labels.checkingTitle,
        /** The description value. */
        description: labels.checkingDescription,
      };
    case 'available':
      return {
        /** The title value. */
        title: labels.availableTitle,
        /** The description value. */
        description: labels.availableDescription,
      };
    case 'downloading':
      return {
        /** The title value. */
        title: labels.downloadingTitle,
        /** The description value. */
        description: labels.downloadingDescription,
      };
    case 'downloaded':
      return {
        /** The title value. */
        title: labels.downloadedTitle,
        /** The description value. */
        description: state.origin === 'automatic'
          ? labels.automaticRestartDescription
          : labels.downloadedDescription,
      };
    case 'up-to-date':
      return {
        /** The title value. */
        title: labels.currentTitle,
        /** The description value. */
        description: labels.currentDescription,
      };
    case 'unsupported':
      return {
        /** The title value. */
        title: labels.unsupportedTitle,
        /** The description value. */
        description: labels.unsupportedDescription,
      };
    case 'error':
      return {
        /** The title value. */
        title: labels.errorTitle,
        /** The description value. */
        description: labels.errorDescription,
      };
  }
}

/** Performs the version summary operation. */
function versionSummary(
  state: ApplicationUpdatePanelState,
  labels: UpdatePanelLabels,
): string {
  const current = `${labels.currentVersion} ${state.currentVersion}`;
  return state.latestVersion && state.latestVersion !== state.currentVersion
    ? `${current} → ${labels.nextVersion} ${state.latestVersion}`
    : current;
}

/** Formats the channel. */
function formatChannel(
  channel: ApplicationUpdatePanelState['channel'],
  labels: UpdatePanelLabels,
): string {
  return labels[channel];
}

/** Formats the progress. */
function formatProgress(value: number): string {
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

/** Formats the bytes. */
function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 3);
  const amount = value / 1024 ** index;
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

/** Selects the localized release notes. */
function selectLocalizedReleaseNotes(
  value: string | undefined,
  locale: AppLocale | string,
): string {
  const notes = value?.trim();
  if (!notes) return '';
  const sections = Array.from(notes.matchAll(/^##\s+(.+)\s*$/gim));
  const releaseLanguages = new Set(['english', '한국어', '日本語']);
  if (
    !sections.some((section) =>
      releaseLanguages.has(section[1].trim().toLowerCase()),
    )
  ) {
    return notes;
  }

  const normalizedLocale = locale.toLowerCase();
  const preferred = normalizedLocale.startsWith('ko')
    ? '한국어'
    : normalizedLocale.startsWith('ja')
      ? '日本語'
      : 'English';
  /** Collects the operation. */
  const collect = (language: string) => sections.flatMap((section, index) => {
    if (section[1].trim().toLowerCase() !== language.toLowerCase()) return [];
    const start = (section.index ?? 0) + section[0].length;
    const end = sections[index + 1]?.index ?? notes.length;
    const content = notes.slice(start, end).trim();
    return content ? [content] : [];
  });
  const localized = collect(preferred);
  const selected = localized.length > 0 ? localized : collect('English');
  return selected.join('\n\n').trim() || notes;
}

/** Performs the plain markdown operation. */
function plainMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}

/** Returns the update panel labels. */
function getUpdatePanelLabels(locale: AppLocale | string): UpdatePanelLabels {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('ko')) {
    return {
      /** The channel value. */
      channel: '채널',
        /** The stable value. */
        stable: 'Stable',
        /** The staging value. */
        staging: 'Staging',
        /** The nightly value. */
        nightly: 'Nightly',
      /** The checking title value. */
      checkingTitle: '업데이트 확인 중',
        /** The checking description value. */
        checkingDescription: 'Kawaikara의 새 버전을 확인하고 있습니다.',
      /** Whether the available title option is enabled. */
      availableTitle: '새 업데이트가 있습니다',
        /** Whether the available description option is enabled. */
        availableDescription: '준비가 되면 업데이트를 다운로드할 수 있습니다.',
      /** The downloading title value. */
      downloadingTitle: '업데이트 다운로드 중',
        /** The downloading description value. */
        downloadingDescription: 'Kawaikara를 계속 사용해도 됩니다.',
      /** The downloaded title value. */
      downloadedTitle: '업데이트 준비 완료',
        /** The downloaded description value. */
        downloadedDescription: '앱을 다시 시작하면 업데이트가 적용됩니다.',
      /** The automatic restart description value. */
      automaticRestartDescription: '업데이트를 적용하기 위해 Kawaikara를 다시 시작합니다.',
      /** The current title value. */
      currentTitle: '최신 버전입니다',
        /** The current description value. */
        currentDescription: '현재 채널에 설치할 업데이트가 없습니다.',
      /** The unsupported title value. */
      unsupportedTitle: '개발 빌드에서는 확인할 수 없습니다',
        /** The unsupported description value. */
        unsupportedDescription: '패키징된 Kawaikara에서 업데이트를 확인해 주세요.',
      /** The error title value. */
      errorTitle: '업데이트를 확인하지 못했습니다',
        /** The error description value. */
        errorDescription: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
      /** The release notes value. */
      releaseNotes: '업데이트 내역',
        /** The no release notes value. */
        noReleaseNotes: '제공된 업데이트 내역이 없습니다.',
      /** The current version value. */
      currentVersion: '현재',
        /** The next version value. */
        nextVersion: '업데이트',
        /** The download value. */
        download: '업데이트 다운로드',
      /** The restart value. */
      restart: '다시 시작하고 업데이트',
        /** The retry value. */
        retry: '다시 확인',
        /** The close value. */
        close: '닫기',
        /** The later value. */
        later: '나중에',
      /** The back value. */
      back: '업데이트 화면으로 돌아가기',
      /** The release notes description value. */
      releaseNotesDescription: '새 버전에 포함된 변경 사항을 확인합니다.',
    };
  }
  if (normalized.startsWith('ja')) {
    return {
      /** The channel value. */
      channel: 'チャンネル',
        /** The stable value. */
        stable: 'Stable',
        /** The staging value. */
        staging: 'Staging',
        /** The nightly value. */
        nightly: 'Nightly',
      /** The checking title value. */
      checkingTitle: 'アップデートを確認中',
        /** The checking description value. */
        checkingDescription: 'Kawaikaraの新しいバージョンを確認しています。',
      /** Whether the available title option is enabled. */
      availableTitle: '新しいアップデートがあります',
        /** Whether the available description option is enabled. */
        availableDescription: '準備ができたらアップデートをダウンロードできます。',
      /** The downloading title value. */
      downloadingTitle: 'アップデートをダウンロード中',
        /** The downloading description value. */
        downloadingDescription: 'ダウンロード中もKawaikaraを使用できます。',
      /** The downloaded title value. */
      downloadedTitle: 'アップデートの準備完了',
        /** The downloaded description value. */
        downloadedDescription: '再起動するとアップデートが適用されます。',
      /** The automatic restart description value. */
      automaticRestartDescription: 'アップデートを適用するためKawaikaraを再起動します。',
      /** The current title value. */
      currentTitle: '最新バージョンです',
        /** The current description value. */
        currentDescription: '現在のチャンネルに利用可能なアップデートはありません。',
      /** The unsupported title value. */
      unsupportedTitle: '開発ビルドでは確認できません',
        /** The unsupported description value. */
        unsupportedDescription: 'パッケージ版のKawaikaraで確認してください。',
      /** The error title value. */
      errorTitle: 'アップデートを確認できませんでした',
        /** The error description value. */
        errorDescription: '接続を確認してもう一度お試しください。',
      /** The release notes value. */
      releaseNotes: '更新内容',
        /** The no release notes value. */
        noReleaseNotes: '更新内容はありません。',
      /** The current version value. */
      currentVersion: '現在',
        /** The next version value. */
        nextVersion: '更新',
        /** The download value. */
        download: 'アップデートをダウンロード',
      /** The restart value. */
      restart: '再起動して更新',
        /** The retry value. */
        retry: '再確認',
        /** The close value. */
        close: '閉じる',
        /** The later value. */
        later: '後で',
      /** The back value. */
      back: 'アップデート画面に戻る',
      /** The release notes description value. */
      releaseNotesDescription: '新しいバージョンに含まれる変更を確認します。',
    };
  }
  return {
    /** The channel value. */
    channel: 'Channel',
      /** The stable value. */
      stable: 'Stable',
      /** The staging value. */
      staging: 'Staging',
      /** The nightly value. */
      nightly: 'Nightly',
    /** The checking title value. */
    checkingTitle: 'Checking for updates',
      /** The checking description value. */
      checkingDescription: 'Looking for a newer Kawaikara release.',
    /** Whether the available title option is enabled. */
    availableTitle: 'An update is available',
      /** Whether the available description option is enabled. */
      availableDescription: 'Download the update whenever you are ready.',
    /** The downloading title value. */
    downloadingTitle: 'Downloading the update',
      /** The downloading description value. */
      downloadingDescription: 'You can continue using Kawaikara while it downloads.',
    /** The downloaded title value. */
    downloadedTitle: 'Update ready',
      /** The downloaded description value. */
      downloadedDescription: 'Restart Kawaikara to finish installing the update.',
    /** The automatic restart description value. */
    automaticRestartDescription: 'Restarting Kawaikara to finish the update.',
    /** The current title value. */
    currentTitle: 'Kawaikara is up to date',
      /** The current description value. */
      currentDescription: 'There are no updates for the current channel.',
    /** The unsupported title value. */
    unsupportedTitle: 'Updates are unavailable in development',
      /** The unsupported description value. */
      unsupportedDescription: 'Check again from a packaged Kawaikara build.',
    /** The error title value. */
    errorTitle: 'Unable to check for updates',
      /** The error description value. */
      errorDescription: 'Check your connection and try again.',
    /** The release notes value. */
    releaseNotes: 'What is new',
      /** The no release notes value. */
      noReleaseNotes: 'No release notes were provided.',
    /** The current version value. */
    currentVersion: 'Current',
      /** The next version value. */
      nextVersion: 'Update',
      /** The download value. */
      download: 'Download update',
    /** The restart value. */
    restart: 'Restart and update',
      /** The retry value. */
      retry: 'Check again',
      /** The close value. */
      close: 'Close',
      /** The later value. */
      later: 'Later',
    /** The back value. */
    back: 'Back to update',
    /** The release notes description value. */
    releaseNotesDescription: 'Review the changes included in the new version.',
  };
}
