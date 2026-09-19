import {
  Button,
  Flex,
  Stack,
  Switch,
  Text
} from '@kawaikara/kawai-ui';
import {
  useEffect,
  useState,
  type MouseEvent
} from 'react';
import type {
  AppMessages,
  BundleInfo,
  BundleRuntimeInfo,
  PreferencePatch,
  PreferenceState
} from '../../../../Common/IPC';
import { ProviderItemListSetting } from '../Bundles/ProviderItemListSetting';
import { getProviderBooleanSetting, onUpdateProviderSetting, resolveProviderText } from '../Logic/ProviderSettings';

/** Inputs shared by the BundlesTab composition and its local sections. */
type BundlesTabProps = {
  /** The action bundle ID value. */
  readonly actionBundleId?: string;
  /** The activation token value. */
  readonly activationToken: number;
  /** The bundles value. */
  readonly bundles: readonly BundleInfo[];
  /** Whether the installing option is enabled. */
  readonly installing: boolean;
  /** The messages value. */
  readonly messages: AppMessages;
  /** The notice value. */
  readonly notice?: string;
  /** The preferences value. */
  readonly preferences: PreferenceState;
  /** The runtime bundles value. */
  readonly runtimeBundles: readonly BundleRuntimeInfo[];
  /** Whether the saving option is enabled. */
  readonly saving: boolean;
  /** Callback used to handle on install. */
  readonly onInstall: () => void | Promise<void>;
  /** Callback used to handle on remove bundle. */
  readonly onRemoveBundle: (bundle: BundleInfo) => void | Promise<void>;
  /** Callback used to handle on update bundle. */
  readonly onUpdateBundle: (bundle: BundleInfo) => void | Promise<void>;
  /** Callback used to handle on update. */
  readonly onUpdate: (patch: PreferencePatch) => void;
};

/** Performs the bundles tab operation. */
export function BundlesTab({
  actionBundleId,
  activationToken,
  bundles,
  installing,
  messages,
  notice,
  preferences,
  runtimeBundles,
  saving,
  onInstall,
  onRemoveBundle,
  onUpdateBundle,
  onUpdate,
}: BundlesTabProps) {
  const [selectedBundleId, setSelectedBundleId] = useState<string>();
  const selectedBundle = bundles.find(({ id }) => id === selectedBundleId);
  const selectedRuntime = runtimeBundles.find(({ id }) => id === selectedBundleId);
  const providersWithSettings = selectedRuntime?.providers.filter(
    (provider) => provider.settings.length > 0,
  ) ?? [];

  useEffect(() => {
    setSelectedBundleId(undefined);
  }, [activationToken]);

  if (selectedBundle) {
    return (
      <Stack className="bundle-detail" gap="lg">
        <Flex align="center" gap="sm">
          <Button
            aria-label={messages.backToBundles}
            size="icon"
            variant="ghost"
            onClick={() => setSelectedBundleId(undefined)}
          >
            <span aria-hidden="true">←</span>
          </Button>
          <div className="bundle-heading-copy">
            <Text className="preference-section-title" weight="semibold">
              {selectedBundle.name}
            </Text>
            <Text size="xs" tone="muted">
              {selectedBundle.description ?? selectedBundle.id} · v{selectedBundle.version}
            </Text>
          </div>
        </Flex>

        {selectedBundle.permissions.length ? (
          <section>
            <Text className="preference-section-title" weight="semibold">
              {messages.permissions}
            </Text>
            <div className="bundle-permission-list">
              {selectedBundle.permissions.map((permission) => (
                <span key={permission}>{permission}</span>
              ))}
            </div>
          </section>
        ) : null}

        {providersWithSettings.map((provider) => (
          <ProviderSettingsSection
            key={provider.id}
            messages={messages}
            preferences={preferences}
            saving={saving}
            onUpdate={onUpdate}
            provider={provider}
          />
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <section>
        <Flex align="start" justify="between" gap="lg">
          <div className="bundle-heading-copy">
            <Text className="preference-section-title" weight="semibold">
              {messages.bundleManagement}
            </Text>
            <Text size="xs" tone="muted">
              {messages.bundlesDescription}
            </Text>
          </div>
          <Button
            isLoading={installing}
            variant="secondary"
            onClick={() => void onInstall()}
          >
            {messages.addBundle}
          </Button>
        </Flex>
        <div className="bundle-trust-warning">
          <Text size="xs" tone="danger">
            {messages.bundleTrustWarning}
          </Text>
        </div>
        {notice ? (
          <Text className="bundle-install-notice" size="xs">
            {notice}
          </Text>
        ) : null}
      </section>

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.installedBundles}
        </Text>
        {bundles.length ? (
          <Stack gap="sm">
            {bundles.map((bundle) => (
              <InstalledBundleCard
                key={bundle.id}
                actionBundleId={actionBundleId}
                messages={messages}
                onRemoveBundle={onRemoveBundle}
                onUpdateBundle={onUpdateBundle}
                bundle={bundle}
                setSelectedBundleId={setSelectedBundleId}
              />
            ))}
          </Stack>
        ) : (
          <Text size="sm" tone="muted">{messages.noBundles}</Text>
        )}
      </section>
    </Stack>
  );
}


/** Renders and updates a single provider-owned setting without owning page state. */
function ProviderSettingControl({
  setting, provider, preferences, messages, saving, onUpdate,
}: Pick<BundlesTabProps, 'preferences' | 'messages' | 'saving' | 'onUpdate'> & {
  /** Provider whose settings are edited. */
  readonly provider: BundleRuntimeInfo['providers'][number];
  /** The discriminated setting definition. */
  readonly setting: BundleRuntimeInfo['providers'][number]['settings'][number]['settings'][number];
}) {
  const title = resolveProviderText(setting.title, preferences.appLocale);
  const description = setting.description
    ? resolveProviderText(setting.description, preferences.appLocale)
    : undefined;
  if (setting.type === 'boolean') {
    return (
      <Switch
        checked={getProviderBooleanSetting(
          preferences,
          provider.id,
          setting.key,
          setting.defaultValue,
        )}
        description={description}
        disabled={saving}
        label={title}
        onCheckedChange={(value) =>
          onUpdateProviderSetting(
            preferences,
            provider.id,
            setting.key,
            value,
            onUpdate,
          )
        }
      />
    );
  }
  const value = preferences.providerSettings[provider.id]?.[setting.key];
  const items = Array.isArray(value) ? value : [];
  return (
    <ProviderItemListSetting
      description={description}
      disabled={saving}
      emptyText={setting.emptyText
        ? resolveProviderText(setting.emptyText, preferences.appLocale)
        : messages.empty}
      items={items}
      messages={messages}
      theme={preferences.appTheme}
      title={title}
      onChange={(nextItems) =>
        onUpdateProviderSetting(
          preferences,
          provider.id,
          setting.key,
          nextItems,
          onUpdate,
        )
      }
    />
  );
}

/** Returns the bundle status label. */
export function getBundleStatusLabel(
  messages: AppMessages,
  bundle: BundleInfo,
): string {
  if (bundle.status === 'active') return messages.bundleActive;
  if (bundle.status === 'restart-required') {
    return messages.bundleRestartRequired;
  }
  return messages.bundleFailed;
}

/** Formats the bundle contributions. */
export function formatBundleContributions(
  messages: AppMessages,
  bundle: BundleInfo,
): string {
  const contributions: string[] = [];
  if (bundle.providerCount) {
    contributions.push(`${String(bundle.providerCount)} ${messages.sites}`);
  }
  if (bundle.pluginCount) {
    contributions.push(`${String(bundle.pluginCount)} ${messages.plugins}`);
  }
  return contributions.join(' · ') || messages.emptyBundle;
}

/** A provider-owned settings category with its editable controls. */
function ProviderSettingCategory({
  messages,
  preferences,
  saving,
  onUpdate,
  provider,
  category,
}: Pick<BundlesTabProps, 'messages' | 'preferences' | 'saving' | 'onUpdate'> & {
  /** provider supplied by the owning composition. */
  readonly provider: BundleRuntimeInfo['providers'][number];
  /** category supplied by the owning composition. */
  readonly category: BundleRuntimeInfo['providers'][number]['settings'][number];
}) {
  return (
    <div className="bundle-setting-category">
      <Text weight="semibold">
        {resolveProviderText(category.title, preferences.appLocale)}
      </Text>
      {category.description ? (
        <Text size="xs" tone="muted">
          {resolveProviderText(category.description, preferences.appLocale)}
        </Text>
      ) : null}
      <Stack gap="md">
        {category.settings.map((setting) => (
          <ProviderSettingControl
            key={setting.key}
            setting={setting}
            provider={provider}
            preferences={preferences}
            messages={messages}
            saving={saving}
            onUpdate={onUpdate}
          />
        ))}
      </Stack>
    </div>
  );
}

/** Composes each provider heading and its settings categories. */
function ProviderSettingsSection({
  messages,
  preferences,
  saving,
  onUpdate,
  provider,
}: Pick<BundlesTabProps, 'messages' | 'preferences' | 'saving' | 'onUpdate'> & {
  /** provider supplied by the owning composition. */
  readonly provider: BundleRuntimeInfo['providers'][number];
}) {
  return (
    <section className="bundle-provider-settings">
      <div className="bundle-provider-heading">
        <Text className="preference-section-title" weight="semibold">
          {provider.title}
        </Text>
        {provider.description ? (
          <Text size="xs" tone="muted">{provider.description}</Text>
        ) : null}
      </div>
      {provider.settings.map((category) => (
        <ProviderSettingCategory
          key={category.id}
          messages={messages}
          preferences={preferences}
          saving={saving}
          onUpdate={onUpdate}
          provider={provider}
          category={category}
        />
      ))}
    </section>
  );
}

/** Bundle summary with selection, update, and removal actions. */
function InstalledBundleCard({
  actionBundleId,
  messages,
  onRemoveBundle,
  onUpdateBundle,
  bundle,
  setSelectedBundleId,
}: Pick<BundlesTabProps, 'actionBundleId' | 'messages' | 'onRemoveBundle' | 'onUpdateBundle'> & {
  /** bundle supplied by the owning composition. */
  readonly bundle: BundleInfo;
  /** setSelectedBundleId supplied by the owning composition. */
  readonly setSelectedBundleId: (id: string | undefined) => void;
}) {
  return (
    <div
      className={`bundle-info-row is-${bundle.status}`}
      role="button"
      tabIndex={0}
      onClick={() => setSelectedBundleId(bundle.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelectedBundleId(bundle.id);
        }
      }}
    >
      <Flex align="start" justify="between" gap="md">
        <div className="bundle-info-copy">
          <Flex align="center" gap="sm">
            <Text weight="semibold">{bundle.name}</Text>
            <span className={`bundle-source-badge is-${bundle.source}`}>
              {bundle.source === 'built-in'
                ? messages.builtInBundle
                : bundle.source === 'development'
                  ? messages.developmentBundle
                  : messages.userBundle}
            </span>
          </Flex>
          <Text size="xs" tone="muted">
            {bundle.description ?? bundle.id}
          </Text>
        </div>
        <Stack className="bundle-version-copy" gap="xs">
          <Text size="xs" tone="muted">v{bundle.version}</Text>
          <Text
            size="xs"
            tone={bundle.status === 'failed' ? 'danger' : 'muted'}
          >
            {getBundleStatusLabel(messages, bundle)}
          </Text>
        </Stack>
      </Flex>
      {bundle.status === 'active' ? (
        <Text className="bundle-contributions" size="xs" tone="muted">
          {formatBundleContributions(messages, bundle)}
        </Text>
      ) : null}
      {bundle.permissions.length ? (
        <div className="bundle-permission-list" aria-label={messages.permissions}>
          {bundle.permissions.map((permission) => (
            <span key={permission}>{permission}</span>
          ))}
        </div>
      ) : null}
      {bundle.error ? (
        <Text className="bundle-error" size="xs" tone="danger">
          {bundle.error}
        </Text>
      ) : null}
      {bundle.updatable || bundle.source === 'user' ? (
        <Flex className="bundle-row-actions" justify="end" gap="sm">
          <Button
            disabled={!bundle.updatable || actionBundleId !== undefined}
            size="sm"
            title={bundle.updatable ? undefined : messages.bundleUpdateUnavailable}
            variant="secondary"
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              void onUpdateBundle(bundle);
            }}
          >
            {messages.bundleUpdate}
          </Button>
          {bundle.source === 'user' ? (
            <Button
              disabled={actionBundleId !== undefined}
              size="sm"
              variant="danger"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                void onRemoveBundle(bundle);
              }}
            >
              {messages.remove}
            </Button>
          ) : null}
        </Flex>
      ) : null}
    </div>
  );
}
