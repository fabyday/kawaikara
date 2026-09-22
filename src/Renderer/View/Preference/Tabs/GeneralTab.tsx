import {
  Button,
  Select,
  Stack,
  Switch,
  Text
} from '@kawaikara/kawai-ui';
import type {
  AppLocale,
  AppMessages,
  AppTheme,
  DisplayInfo,
  GraphicsMode,
  PreferencePatch,
  PreferenceState,
  SiteMenuItem
} from '../../../../Common/IPC';
import {
  PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS,
  PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS,
} from '../../../../Common/PictureInPicture';
import { DescriptiveSelect } from '../DescriptiveSelect';
import { PictureInPicturePlacementControl } from '../PictureInPicturePlacementControl';
import { PictureInPictureSizeControl } from '../PictureInPictureSizeControl';
import { SubtitleScaleControl } from '../SubtitleScaleControl';
import { GraphicsModeControl } from '../GraphicsModeControl';
import { appLocaleOptions, appThemeOptions } from '../Logic/PreferenceOptions';

/** Inputs shared by the GeneralTab composition and its local sections. */
type GeneralTabProps = {
  /** The data action ID value. */
  readonly dataActionId?: string;
  /** Whether the data actions disabled option is enabled. */
  readonly dataActionsDisabled: boolean;
  /** The displays value. */
  readonly displays: readonly DisplayInfo[];
  /** The graphics mode value. */
  readonly graphicsMode: GraphicsMode;
  /** The messages value. */
  readonly messages: AppMessages;
  /** The preferences value. */
  readonly preferences: PreferenceState;
  /** Whether the saving option is enabled. */
  readonly saving: boolean;
  /** The site options value. */
  readonly siteOptions: readonly {
    /** The label value. */
    label: string;
    /** The value value. */
    value: string;
  }[];
  /** The sites value. */
  readonly sites: readonly SiteMenuItem[];
  /** Callback used to handle on edit menu order. */
  readonly onEditMenuOrder: () => void;
  /** Callback used to handle on clear application cache. */
  readonly onClearApplicationCache: () => void | Promise<void>;
  /** Callback used to handle on graphics mode change. */
  readonly onGraphicsModeChange: (graphicsMode: GraphicsMode) => void;
  /** Callback used to handle on reset application. */
  readonly onResetApplication: () => void | Promise<void>;
  /** Callback used to handle on update. */
  readonly onUpdate: (patch: PreferencePatch) => void;
};

/** Performs the general tab operation. */
export function GeneralTab({
  dataActionId,
  dataActionsDisabled,
  displays,
  graphicsMode,
  messages,
  preferences,
  saving,
  siteOptions,
  sites,
  onEditMenuOrder,
  onClearApplicationCache,
  onGraphicsModeChange,
  onResetApplication,
  onUpdate,
}: GeneralTabProps) {
  return (
    <Stack gap="lg">
      <LanguageSettings
        messages={messages}
        preferences={preferences}
        saving={saving}
        onUpdate={onUpdate}
      />

      <AppearanceSettings
        messages={messages}
        preferences={preferences}
        saving={saving}
        onUpdate={onUpdate}
      />

      <DefaultSiteSettings
        messages={messages}
        preferences={preferences}
        saving={saving}
        siteOptions={siteOptions}
        onUpdate={onUpdate}
      />

      <MenuOrderSettings
        messages={messages}
        saving={saving}
        sites={sites}
        onEditMenuOrder={onEditMenuOrder}
      />

      <PictureInPictureSettings
        displays={displays}
        messages={messages}
        preferences={preferences}
        saving={saving}
        onUpdate={onUpdate}
      />

      <LoggingSettings
        messages={messages}
        preferences={preferences}
        saving={saving}
        onUpdate={onUpdate}
      />

      <ViewerSettings
        messages={messages}
        preferences={preferences}
        saving={saving}
        onUpdate={onUpdate}
      />

      <PerformanceSettings
        graphicsMode={graphicsMode}
        messages={messages}
        saving={saving}
        onGraphicsModeChange={onGraphicsModeChange}
      />

      <ApplicationDataSettings
        dataActionId={dataActionId}
        dataActionsDisabled={dataActionsDisabled}
        messages={messages}
        saving={saving}
        onClearApplicationCache={onClearApplicationCache}
        onResetApplication={onResetApplication}
      />
    </Stack>
  );
}

/** Controls for language, owned by the general preference page. */
function LanguageSettings({
  messages,
  preferences,
  saving,
  onUpdate,
}: Pick<GeneralTabProps, 'messages' | 'preferences' | 'saving' | 'onUpdate'>) {
  return (
    <section>
      <Text className="preference-section-title" weight="semibold">
        {messages.language}
      </Text>
      <Select
        disabled={saving}
        label={messages.appLanguage}
        options={appLocaleOptions(messages)}
        value={preferences.appLocale}
        description={messages.globalLanguageDescription}
        onValueChange={(appLocale) =>
          onUpdate({
            appLocale: appLocale as AppLocale,
            pluginLocales: {},
            siteLocales: {},
          })
        }
      />
    </section>
  );
}

/** Controls for appearance, owned by the general preference page. */
function AppearanceSettings({
  messages,
  preferences,
  saving,
  onUpdate,
}: Pick<GeneralTabProps, 'messages' | 'preferences' | 'saving' | 'onUpdate'>) {
  return (
    <section>
      <Text className="preference-section-title" weight="semibold">
        {messages.appearance}
      </Text>
      <Select
        disabled={saving}
        label={messages.appTheme}
        options={appThemeOptions(messages)}
        value={preferences.appTheme}
        description={messages.appThemeDescription}
        onValueChange={(appTheme) =>
          onUpdate({
            appTheme: appTheme as AppTheme
          })
        }
      />
    </section>
  );
}

/** Controls for defaultSite, owned by the general preference page. */
function DefaultSiteSettings({
  messages,
  preferences,
  saving,
  siteOptions,
  onUpdate,
}: Pick<GeneralTabProps, 'messages' | 'preferences' | 'saving' | 'siteOptions' | 'onUpdate'>) {
  return (
    <section>
      <Select
        disabled={saving}
        label={messages.defaultSite}
        options={siteOptions}
        value={preferences.defaultSiteId}
        description={messages.defaultSiteDescription}
        onValueChange={(defaultSiteId) => onUpdate({
          defaultSiteId
        })}
      />
    </section>
  );
}

/** Controls for menuOrder, owned by the general preference page. */
function MenuOrderSettings({
  messages,
  saving,
  sites,
  onEditMenuOrder,
}: Pick<GeneralTabProps, 'messages' | 'saving' | 'sites' | 'onEditMenuOrder'>) {
  return (
    <section>
      <div className="menu-order-setting">
        <div>
          <Text weight="semibold">{messages.menuOrder}</Text>
          <Text size="xs" tone="muted">
            {messages.menuOrderDescription}
          </Text>
        </div>
        <Button disabled={saving || sites.length === 0} onClick={onEditMenuOrder}>
          {messages.editMenuOrder}
        </Button>
      </div>
    </section>
  );
}

/** Controls for pictureInPictureSettings, owned by the general preference page. */
function PictureInPictureSettings({
  displays,
  messages,
  preferences,
  saving,
  onUpdate,
}: Pick<GeneralTabProps, 'displays' | 'messages' | 'preferences' | 'saving' | 'onUpdate'>) {
  return (
    <Stack gap="sm">
      <Text weight="semibold">
        {messages.pictureInPictureSettings}
      </Text>
      <div className="pip-preference-grid">
        <PictureInPictureSizeControl
          disabled={saving}
          messages={{
            compact: messages.pipSizeCompact,
            custom: messages.pipSizeCustom,
            description: messages.pictureInPictureSizeDescription,
            height: messages.pipHeight,
            large: messages.pipSizeLarge,
            medium: messages.pipSizeMedium,
            pixels: messages.pixels,
            size: messages.pictureInPictureSize,
            width: messages.pipWidth,
          }}
          value={preferences.pictureInPictureSize}
          onChange={(pictureInPictureSize) =>
            onUpdate({
              pictureInPictureSize
            })
          }
        />
        <PictureInPictureSizeControl
          disabled={saving}
          limits={PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS}
          presets={PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS}
          messages={{
            compact: messages.pipSizeCompact,
            custom: messages.pipSizeCustom,
            description: messages.pictureInPicturePortraitSizeDescription,
            height: messages.pipHeight,
            large: messages.pipSizeLarge,
            medium: messages.pipSizeMedium,
            pixels: messages.pixels,
            size: messages.pictureInPicturePortraitSize,
            width: messages.pipWidth,
          }}
          value={preferences.pictureInPicturePortraitSize}
          onChange={(pictureInPicturePortraitSize) =>
            onUpdate({
              pictureInPicturePortraitSize
            })
          }
        />
        <div className="pip-preference-placement">
          <PictureInPicturePlacementControl
            disabled={saving}
            displays={displays}
            messages={{
              bottomLeft: messages.pipPositionBottomLeft,
              bottomRight: messages.pipPositionBottomRight,
              currentDisplay: messages.pipMonitorCurrent,
              display: messages.pipMonitorDisplay,
              lastDisplay: messages.pipMonitorLast,
              lastPosition: messages.pipPositionLast,
              monitor: messages.pictureInPictureMonitor,
              monitorDescription: messages.pictureInPictureMonitorDescription,
              position: messages.pictureInPicturePosition,
              positionDescription: messages.pictureInPicturePositionDescription,
              primary: messages.primaryDisplay,
              topLeft: messages.pipPositionTopLeft,
              topRight: messages.pipPositionTopRight,
              unavailableDisplay: messages.unavailableDisplay,
              videoDisplay: messages.pipMonitorVideo,
            }}
            value={preferences.pictureInPicturePlacement}
            onChange={(pictureInPicturePlacement) =>
              onUpdate({
                pictureInPicturePlacement
              })
            }
          />
        </div>
        <div className="pip-preference-placement">
          <SubtitleScaleControl
            disabled={saving}
            label={messages.pictureInPictureSubtitleSize}
            description={messages.pictureInPictureSubtitleSizeDescription}
            rangeMessage={messages.pictureInPictureSubtitleSizeRange}
            value={preferences.pictureInPictureSubtitleScale}
            onChange={(pictureInPictureSubtitleScale) =>
              onUpdate({ pictureInPictureSubtitleScale })
            }
          />
        </div>
      </div>
    </Stack>
  );
}

/** Controls for logLevel, owned by the general preference page. */
function LoggingSettings({
  messages,
  preferences,
  saving,
  onUpdate,
}: Pick<GeneralTabProps, 'messages' | 'preferences' | 'saving' | 'onUpdate'>) {
  return (
    <section>
      <Text className="preference-section-title" weight="semibold">
        {messages.logLevel}
      </Text>
      <DescriptiveSelect
        disabled={saving}
        label={messages.logLevel}
        options={[
          {
            label: messages.logLevelError,
            description: messages.logLevelErrorDescription,
            value: 'error',
          },
          {
            label: messages.logLevelWarn,
            description: messages.logLevelWarnDescription,
            value: 'warn',
          },
          {
            label: messages.logLevelInfo,
            description: messages.logLevelInfoDescription,
            value: 'info',
          },
          {
            label: messages.logLevelVerbose,
            description: messages.logLevelVerboseDescription,
            value: 'verbose',
          },
          {
            label: messages.logLevelDebug,
            description: messages.logLevelDebugDescription,
            value: 'debug',
          },
          {
            label: messages.logLevelNone,
            description: messages.logLevelNoneDescription,
            value: 'none',
          },
        ]}
        value={preferences.logLevel}
        description={messages.logLevelDescription}
        onValueChange={(logLevel) =>
          onUpdate({
            logLevel: logLevel as PreferenceState['logLevel']
          })
        }
      />
    </section>
  );
}

/** Controls for viewer, owned by the general preference page. */
function ViewerSettings({
  messages,
  preferences,
  saving,
  onUpdate,
}: Pick<GeneralTabProps, 'messages' | 'preferences' | 'saving' | 'onUpdate'>) {
  return (
    <section>
      <Text className="preference-section-title" weight="semibold">
        {messages.viewer}
      </Text>
      <Stack gap="md">
        <Switch
          checked={preferences.alwaysOnTop}
          disabled={saving}
          label={messages.alwaysOnTop}
          description={messages.alwaysOnTopDescription}
          onCheckedChange={(alwaysOnTop) => onUpdate({
            alwaysOnTop
          })}
        />
        <Switch
          checked={preferences.openMenuOnStartup}
          disabled={saving}
          label={messages.openMenuOnStartup}
          description={messages.openMenuOnStartupDescription}
          onCheckedChange={(openMenuOnStartup) =>
            onUpdate({
              openMenuOnStartup
            })
          }
        />
        <Switch
          checked={preferences.closeMenuOnEscape}
          disabled={saving}
          label={messages.closeMenuOnEscape}
          description={messages.closeMenuOnEscapeDescription}
          onCheckedChange={(closeMenuOnEscape) =>
            onUpdate({
              closeMenuOnEscape
            })
          }
        />
        <Switch
          checked={preferences.closeMenuOnOutsideClick}
          disabled={saving}
          label={messages.closeMenuOnOutsideClick}
          description={messages.closeMenuOnOutsideClickDescription}
          onCheckedChange={(closeMenuOnOutsideClick) =>
            onUpdate({
              closeMenuOnOutsideClick
            })
          }
        />
      </Stack>
    </section>
  );
}

/** Controls for performance, owned by the general preference page. */
function PerformanceSettings({
  graphicsMode,
  messages,
  saving,
  onGraphicsModeChange,
}: Pick<GeneralTabProps, 'graphicsMode' | 'messages' | 'saving' | 'onGraphicsModeChange'>) {
  return (
    <section>
      <Text className="preference-section-title" weight="semibold">
        {messages.performance}
      </Text>
      <GraphicsModeControl
        disabled={saving}
        messages={messages}
        value={graphicsMode}
        onChange={onGraphicsModeChange}
      />
    </section>
  );
}

/** Controls for dataManagement, owned by the general preference page. */
function ApplicationDataSettings({
  dataActionId,
  dataActionsDisabled,
  messages,
  saving,
  onClearApplicationCache,
  onResetApplication,
}: Pick<GeneralTabProps, 'dataActionId' | 'dataActionsDisabled' | 'messages' | 'saving' | 'onClearApplicationCache' | 'onResetApplication'>) {
  return (
    <section>
      <Text className="preference-section-title" weight="semibold">
        {messages.dataManagement}
      </Text>
      <Stack gap="sm">
        <div className="application-data-row">
          <div className="application-data-copy">
            <Text weight="semibold">{messages.applicationCacheReset}</Text>
            <Text size="xs" tone="muted">
              {messages.applicationCacheResetDescription}
            </Text>
          </div>
          <Button
            disabled={saving || dataActionsDisabled || Boolean(dataActionId)}
            isLoading={dataActionId === 'application-cache'}
            size="sm"
            variant="secondary"
            onClick={() => void onClearApplicationCache()}
          >
            {messages.applicationCacheReset}
          </Button>
        </div>
        <div className="application-data-row is-danger">
          <div className="application-data-copy">
            <Text weight="semibold">{messages.applicationReset}</Text>
            <Text size="xs" tone="muted">
              {messages.applicationResetDescription}
            </Text>
          </div>
          <Button
            disabled={saving || dataActionsDisabled || Boolean(dataActionId)}
            isLoading={dataActionId === 'application-reset'}
            size="sm"
            variant="danger"
            onClick={() => void onResetApplication()}
          >
            {messages.applicationReset}
          </Button>
        </div>
      </Stack>
    </section>
  );
}
