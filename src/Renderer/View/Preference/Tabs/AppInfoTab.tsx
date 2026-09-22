import {
  Button,
  Flex,
  Head,
  Stack,
  Switch,
  Text
} from '@kawaikara/kawai-ui';
import kawaikaraIcon from '../../../../../resources/icons/app-kawaikara.png';
import type { ReleaseChannel } from '../../../../Common/BuildConfig';
import type {
  ApplicationInfo,
  ApplicationLinkId,
  ApplicationUpdateCheckResult,
  AppMessages,
  DeveloperYouTubeStatus,
  PreferencePatch,
  PreferenceState
} from '../../../../Common/IPC';
import { DeveloperLinks } from '../DeveloperLinks';

/** Performs the app info tab operation. */
export function AppInfoTab({
  appInfo,
  checkingUpdates,
  developerYouTubeStatus,
  messages,
  preferences,
  saving,
  updateCheckResult,
  onCheckForUpdates,
  onOpenLogDirectory,
  onOpenLogViewer,
  onOpenLink,
  onUpdate,
}: {
  /** The app info value. */
  readonly appInfo?: ApplicationInfo;
  /** Whether the checking updates option is enabled. */
  readonly checkingUpdates: boolean;
  /** The developer you tube status value. */
  readonly developerYouTubeStatus?: DeveloperYouTubeStatus;
  /** The messages value. */
  readonly messages: AppMessages;
  /** The preferences value. */
  readonly preferences: PreferenceState;
  /** Whether the saving option is enabled. */
  readonly saving: boolean;
  /** The update check result value. */
  readonly updateCheckResult?: ApplicationUpdateCheckResult;
  /** Callback used to handle on check for updates. */
  readonly onCheckForUpdates: () => void | Promise<void>;
  /** Callback used to handle on open log directory. */
  readonly onOpenLogDirectory: () => void | Promise<void>;
  /** Callback used to handle on open log viewer. */
  readonly onOpenLogViewer: () => void;
  /** Callback used to handle on open link. */
  readonly onOpenLink: (id: ApplicationLinkId) => void | Promise<void>;
  /** Callback used to handle on update. */
  readonly onUpdate: (patch: PreferencePatch) => void;
}
) {
  const updateStatus = getUpdateStatusMessage(messages, updateCheckResult);
  return (
    <Stack gap="lg">
      <div className="app-info-links">
        <DeveloperLinks
          messages={messages}
          youtubeStatus={developerYouTubeStatus}
          onOpen={onOpenLink}
        />
      </div>
      {appInfo ? (
        <div className="app-info-card">
          <Flex className="app-info-title" align="start" justify="between" gap="lg">
            <Flex className="app-info-identity" align="center" gap="sm">
              <img alt="" className="app-info-icon" src={kawaikaraIcon} />
              <Stack gap="xs">
                <Head level={2} size="sm">
                  {appInfo.name}
                </Head>
                <Text size="xs" tone="muted">
                  {messages.appDescription}
                </Text>
              </Stack>
            </Flex>
            <Switch
              className="app-info-auto-update"
              checked={preferences.automaticUpdates}
              controlClassName="app-info-auto-update-control"
              controlSize="sm"
              disabled={saving}
              label={messages.automaticUpdates}
              title={messages.automaticUpdatesDescription}
              onCheckedChange={(automaticUpdates) =>
                onUpdate({
                  automaticUpdates
                })
              }
            />
          </Flex>
          <div className="app-release-panel">
            <div className="app-release-row">
              <Text size="xs" tone="muted">{messages.channel}</Text>
              <div className="app-release-value">
                <Text className="app-channel-fixed" weight="semibold">
                  {getChannelLabel(messages, appInfo.buildChannel)}
                </Text>
              </div>
            </div>
            <div className="app-release-row">
              <Text size="xs" tone="muted">{messages.version}</Text>
              <Flex className="app-release-value" align="center" justify="between" gap="sm">
                <Text className="app-version-value" weight="semibold">
                  {appInfo.version}
                </Text>
                <Button
                  isLoading={checkingUpdates}
                  size="sm"
                  variant="secondary"
                  onClick={() => void onCheckForUpdates()}
                >
                  {messages.checkForUpdates}
                </Button>
              </Flex>
            </div>
          </div>
          {checkingUpdates || updateStatus ? (
            <Text
              className={`app-update-status${updateCheckResult?.status === 'error' ? ' is-error' : ''}`}
              size="xs"
              tone={updateCheckResult?.status === 'error' ? 'danger' : 'muted'}
            >
              {checkingUpdates ? messages.checkingForUpdates : updateStatus}
            </Text>
          ) : null}
          <InfoRow label={messages.siteApi} value={`v${String(appInfo.siteApiVersion)}`} />
          <InfoRow
            label={messages.runtime}
            value={`Electron ${appInfo.electronVersion} · Chrome ${appInfo.chromeVersion}`}
          />
          <InfoRow
            label={messages.platform}
            value={`${appInfo.platform} · ${appInfo.arch}`}
          />
          <Flex className="app-log-row" align="center" justify="between" gap="md">
            <Stack gap="xs">
              <Text size="sm">{messages.diagnosticLogs}</Text>
              <Text size="xs" tone="muted">
                {messages.diagnosticLogsDescription}
              </Text>
            </Stack>
            <Flex className="app-log-actions" align="center" justify="end" gap="xs" wrap>
              <Button size="sm" variant="secondary" onClick={onOpenLogViewer}>
                {messages.logViewer}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void onOpenLogDirectory()}
              >
                {messages.openLogDirectory}
              </Button>
            </Flex>
          </Flex>
        </div>
      ) : null}
    </Stack>
  );
}

/** Returns the channel label. */
export function getChannelLabel(messages: AppMessages, channel: ReleaseChannel): string {
  return {
    stable: messages.stableChannel,
    staging: messages.stagingChannel,
    nightly: messages.nightlyChannel,
  }[channel];
}

/** Returns the update status message. */
export function getUpdateStatusMessage(
  messages: AppMessages,
  result?: ApplicationUpdateCheckResult,
): string | undefined {
  if (!result) return undefined;
  if (result.status === 'up-to-date') return messages.latestVersion;
  if (result.status === 'unsupported') return messages.updateUnavailable;
  if (result.status === 'error') return messages.updateCheckFailed;
  return messages.updateAvailable.replace(
    '{version}',
    result.latestVersion ?? '',
  );
}

/** Performs the info row operation. */
export function InfoRow({ label, value }: {
  /** The label value. */
  readonly label: string;
  /** The value value. */
  readonly value: string;
}
) {
  return (
    <Flex className="app-info-row" align="center" justify="between" gap="md">
      <Text size="sm" tone="muted">{label}</Text>
      <Text size="sm">{value}</Text>
    </Flex>
  );
}
