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

export interface UpdatePanelProps {
  readonly state: ApplicationUpdatePanelState;
  readonly locale?: AppLocale | string;
  readonly onDismiss: () => void;
  readonly onDownload: () => void | Promise<void>;
  readonly onInstall: () => void | Promise<void>;
  readonly onRetry: () => void | Promise<void>;
  readonly initialView?: 'status' | 'release-notes';
  readonly view?: 'status' | 'release-notes';
  readonly onViewChange?: (view: 'status' | 'release-notes') => void;
}

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

interface UpdatePanelLabels {
  readonly channel: string;
  readonly stable: string;
  readonly staging: string;
  readonly nightly: string;
  readonly checkingTitle: string;
  readonly checkingDescription: string;
  readonly availableTitle: string;
  readonly availableDescription: string;
  readonly downloadingTitle: string;
  readonly downloadingDescription: string;
  readonly downloadedTitle: string;
  readonly downloadedDescription: string;
  readonly automaticRestartDescription: string;
  readonly currentTitle: string;
  readonly currentDescription: string;
  readonly unsupportedTitle: string;
  readonly unsupportedDescription: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly releaseNotes: string;
  readonly noReleaseNotes: string;
  readonly currentVersion: string;
  readonly nextVersion: string;
  readonly download: string;
  readonly restart: string;
  readonly retry: string;
  readonly close: string;
  readonly later: string;
  readonly back: string;
  readonly releaseNotesDescription: string;
}

function UpdateReleaseNotesView({
  labels,
  notes,
  state,
  onBack,
}: {
  readonly labels: UpdatePanelLabels;
  readonly notes: string;
  readonly state: ApplicationUpdatePanelState;
  readonly onBack: () => void;
}) {
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

function ReleaseNotesContent({ notes }: { readonly notes: string }) {
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

function UpdateActions({
  labels,
  origin,
  phase,
  onDismiss,
  onDownload,
  onInstall,
  onRetry,
}: {
  readonly labels: UpdatePanelLabels;
  readonly origin: ApplicationUpdatePanelState['origin'];
  readonly phase: ApplicationUpdatePanelState['phase'];
  readonly onDismiss: () => void;
  readonly onDownload: () => void | Promise<void>;
  readonly onInstall: () => void | Promise<void>;
  readonly onRetry: () => void | Promise<void>;
}) {
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

function getProgressValue(state: ApplicationUpdatePanelState): number | null {
  if (state.phase === 'checking') return null;
  if (state.phase === 'downloading') return state.progress?.percent ?? 0;
  if (state.phase === 'downloaded' || state.phase === 'up-to-date') return 100;
  return 0;
}

function getPhaseCopy(
  state: ApplicationUpdatePanelState,
  labels: UpdatePanelLabels,
) {
  switch (state.phase) {
    case 'checking':
      return { title: labels.checkingTitle, description: labels.checkingDescription };
    case 'available':
      return { title: labels.availableTitle, description: labels.availableDescription };
    case 'downloading':
      return { title: labels.downloadingTitle, description: labels.downloadingDescription };
    case 'downloaded':
      return {
        title: labels.downloadedTitle,
        description: state.origin === 'automatic'
          ? labels.automaticRestartDescription
          : labels.downloadedDescription,
      };
    case 'up-to-date':
      return { title: labels.currentTitle, description: labels.currentDescription };
    case 'unsupported':
      return { title: labels.unsupportedTitle, description: labels.unsupportedDescription };
    case 'error':
      return { title: labels.errorTitle, description: labels.errorDescription };
  }
}

function versionSummary(
  state: ApplicationUpdatePanelState,
  labels: UpdatePanelLabels,
): string {
  const current = `${labels.currentVersion} ${state.currentVersion}`;
  return state.latestVersion && state.latestVersion !== state.currentVersion
    ? `${current} → ${labels.nextVersion} ${state.latestVersion}`
    : current;
}

function formatChannel(
  channel: ApplicationUpdatePanelState['channel'],
  labels: UpdatePanelLabels,
): string {
  return labels[channel];
}

function formatProgress(value: number): string {
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 3);
  const amount = value / 1024 ** index;
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

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

function plainMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}

function getUpdatePanelLabels(locale: AppLocale | string): UpdatePanelLabels {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('ko')) {
    return {
      channel: '채널', stable: 'Stable', staging: 'Staging', nightly: 'Nightly',
      checkingTitle: '업데이트 확인 중', checkingDescription: 'Kawaikara의 새 버전을 확인하고 있습니다.',
      availableTitle: '새 업데이트가 있습니다', availableDescription: '준비가 되면 업데이트를 다운로드할 수 있습니다.',
      downloadingTitle: '업데이트 다운로드 중', downloadingDescription: 'Kawaikara를 계속 사용해도 됩니다.',
      downloadedTitle: '업데이트 준비 완료', downloadedDescription: '앱을 다시 시작하면 업데이트가 적용됩니다.',
      automaticRestartDescription: '업데이트를 적용하기 위해 Kawaikara를 다시 시작합니다.',
      currentTitle: '최신 버전입니다', currentDescription: '현재 채널에 설치할 업데이트가 없습니다.',
      unsupportedTitle: '개발 빌드에서는 확인할 수 없습니다', unsupportedDescription: '패키징된 Kawaikara에서 업데이트를 확인해 주세요.',
      errorTitle: '업데이트를 확인하지 못했습니다', errorDescription: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
      releaseNotes: '업데이트 내역', noReleaseNotes: '제공된 업데이트 내역이 없습니다.',
      currentVersion: '현재', nextVersion: '업데이트', download: '업데이트 다운로드',
      restart: '다시 시작하고 업데이트', retry: '다시 확인', close: '닫기', later: '나중에',
      back: '업데이트 화면으로 돌아가기',
      releaseNotesDescription: '새 버전에 포함된 변경 사항을 확인합니다.',
    };
  }
  if (normalized.startsWith('ja')) {
    return {
      channel: 'チャンネル', stable: 'Stable', staging: 'Staging', nightly: 'Nightly',
      checkingTitle: 'アップデートを確認中', checkingDescription: 'Kawaikaraの新しいバージョンを確認しています。',
      availableTitle: '新しいアップデートがあります', availableDescription: '準備ができたらアップデートをダウンロードできます。',
      downloadingTitle: 'アップデートをダウンロード中', downloadingDescription: 'ダウンロード中もKawaikaraを使用できます。',
      downloadedTitle: 'アップデートの準備完了', downloadedDescription: '再起動するとアップデートが適用されます。',
      automaticRestartDescription: 'アップデートを適用するためKawaikaraを再起動します。',
      currentTitle: '最新バージョンです', currentDescription: '現在のチャンネルに利用可能なアップデートはありません。',
      unsupportedTitle: '開発ビルドでは確認できません', unsupportedDescription: 'パッケージ版のKawaikaraで確認してください。',
      errorTitle: 'アップデートを確認できませんでした', errorDescription: '接続を確認してもう一度お試しください。',
      releaseNotes: '更新内容', noReleaseNotes: '更新内容はありません。',
      currentVersion: '現在', nextVersion: '更新', download: 'アップデートをダウンロード',
      restart: '再起動して更新', retry: '再確認', close: '閉じる', later: '後で',
      back: 'アップデート画面に戻る',
      releaseNotesDescription: '新しいバージョンに含まれる変更を確認します。',
    };
  }
  return {
    channel: 'Channel', stable: 'Stable', staging: 'Staging', nightly: 'Nightly',
    checkingTitle: 'Checking for updates', checkingDescription: 'Looking for a newer Kawaikara release.',
    availableTitle: 'An update is available', availableDescription: 'Download the update whenever you are ready.',
    downloadingTitle: 'Downloading the update', downloadingDescription: 'You can continue using Kawaikara while it downloads.',
    downloadedTitle: 'Update ready', downloadedDescription: 'Restart Kawaikara to finish installing the update.',
    automaticRestartDescription: 'Restarting Kawaikara to finish the update.',
    currentTitle: 'Kawaikara is up to date', currentDescription: 'There are no updates for the current channel.',
    unsupportedTitle: 'Updates are unavailable in development', unsupportedDescription: 'Check again from a packaged Kawaikara build.',
    errorTitle: 'Unable to check for updates', errorDescription: 'Check your connection and try again.',
    releaseNotes: 'What is new', noReleaseNotes: 'No release notes were provided.',
    currentVersion: 'Current', nextVersion: 'Update', download: 'Download update',
    restart: 'Restart and update', retry: 'Check again', close: 'Close', later: 'Later',
    back: 'Back to update',
    releaseNotesDescription: 'Review the changes included in the new version.',
  };
}
