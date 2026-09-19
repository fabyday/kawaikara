import {
  Button,
  Flex,
  Input,
  Select,
  Stack,
  Text
} from '@kawaikara/kawai-ui';
import {
  useState
} from 'react';
import type {
  AppMessages,
  BrowserProfileInfo,
  BundleRuntimeInfo,
  PreferencePatch,
  PreferenceState,
  SiteMenuItem,
  UserBrowserProfile
} from '../../../../Common/IPC';
import { createUserBrowserProfileId, profileAssignmentDescription, profileName, profileOptions } from '../Logic/BrowserProfiles';

/** Performs the browser profiles tab operation. */
export function BrowserProfilesTab({
  bundles,
  dataActionId,
  dataActionsDisabled,
  messages,
  preferences,
  saving,
  sites,
  onClearAllBrowserProfiles,
  onClearIsolatedSiteData,
  onClearProfileData,
  onUpdate,
}: {
  /** The bundles value. */
  readonly bundles: readonly BundleRuntimeInfo[];
  /** The data action ID value. */
  readonly dataActionId?: string;
  /** Whether the data actions disabled option is enabled. */
  readonly dataActionsDisabled: boolean;
  /** The messages value. */
  readonly messages: AppMessages;
  /** The preferences value. */
  readonly preferences: PreferenceState;
  /** Whether the saving option is enabled. */
  readonly saving: boolean;
  /** The sites value. */
  readonly sites: readonly SiteMenuItem[];
  /** Callback used to handle on clear all browser profiles. */
  readonly onClearAllBrowserProfiles: () => void | Promise<void>;
  /** Callback used to handle on clear isolated site data. */
  readonly onClearIsolatedSiteData: (site: SiteMenuItem) => void | Promise<void>;
  /** Callback used to handle on clear profile data. */
  readonly onClearProfileData: (profile: BrowserProfileInfo) => void | Promise<void>;
  /** Callback used to handle on update. */
  readonly onUpdate: (patch: PreferencePatch) => void;
}
) {
  const [newProfileName, setNewProfileName] = useState('');
  const pluginProfiles = bundles.flatMap((bundle) => bundle.browserProfiles);
  const userProfiles: BrowserProfileInfo[] = preferences.browserProfiles.map(
    (profile) => ({
      id: `user:${profile.id}`,
      name: profile.name,
      persistent: profile.persistent,
      source: 'user',
    }),
  );
  const allProfiles = [...pluginProfiles, ...userProfiles];

  /** Performs the add profile operation. */
  const addProfile = () => {
    const name = newProfileName.trim();
    if (!name) return;
    const profile: UserBrowserProfile = {
      id: createUserBrowserProfileId(),
      name,
      persistent: true,
    };
    onUpdate({
      browserProfiles: [...preferences.browserProfiles, profile]
    });
    setNewProfileName('');
  };

  /** Removes the profile. */
  const removeProfile = (profile: UserBrowserProfile) => {
    const removedId = `user:${profile.id}`;
    onUpdate({
      browserProfiles: preferences.browserProfiles.filter(
        (candidate) => candidate.id !== profile.id,
      ),
      siteBrowserProfiles: Object.fromEntries(
        Object.entries(preferences.siteBrowserProfiles).filter(
          ([, assigned]) => assigned !== removedId,
        ),
      ),
    });
  };

  return (
    <Stack gap="lg">
      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.browserProfiles}
        </Text>
        <Text size="xs" tone="muted">
          {messages.browserProfilesDescription}
        </Text>
        <Flex className="profile-create-row" align="end" gap="sm">
          <Input
            disabled={saving}
            label={messages.profileName}
            placeholder={messages.profileNamePlaceholder}
            value={newProfileName}
            onChange={(event) => setNewProfileName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addProfile();
            }}
          />
          <Button disabled={saving || !newProfileName.trim()} onClick={addProfile}>
            {messages.addProfile}
          </Button>
        </Flex>
      </section>

      {pluginProfiles.length ? (
        <section>
          <Text className="preference-section-title" weight="semibold">
            {messages.pluginProfiles}
          </Text>
          <Stack gap="sm">
            {pluginProfiles.map((profile) => (
              <BrowserProfileCard
                clearDisabled={saving || dataActionsDisabled || Boolean(dataActionId)}
                clearLoading={dataActionId === `profile:${profile.id}`}
                key={profile.id}
                messages={messages}
                profile={profile}
                onClear={() => void onClearProfileData(profile)}
              />
            ))}
          </Stack>
        </section>
      ) : null}

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.userProfiles}
        </Text>
        {preferences.browserProfiles.length ? (
          <Stack gap="sm">
            {preferences.browserProfiles.map((profile) => {
              const runtimeProfile: BrowserProfileInfo = {
                id: `user:${profile.id}`,
                name: profile.name,
                persistent: profile.persistent,
                source: 'user',
              };
              return (
                <BrowserProfileCard
                  clearDisabled={saving || dataActionsDisabled || Boolean(dataActionId)}
                  clearLoading={dataActionId === `profile:${runtimeProfile.id}`}
                  key={profile.id}
                  messages={messages}
                  profile={runtimeProfile}
                  removeDisabled={saving || Boolean(dataActionId)}
                  onClear={() => void onClearProfileData(runtimeProfile)}
                  onRemove={() => removeProfile(profile)}
                />
              );
            })}
          </Stack>
        ) : (
          <Text size="sm" tone="muted">{messages.noUserProfiles}</Text>
        )}
      </section>

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.siteProfileAssignments}
        </Text>
        <Text size="xs" tone="muted">
          {messages.siteProfileAssignmentsDescription}
        </Text>
        <Stack className="profile-site-list" gap="sm">
          {sites.map((site) => {
            const explicit = preferences.siteBrowserProfiles[site.id];
            const defaultProfileId = site.defaultBrowserProfileId;
            const effective =
              explicit ?? defaultProfileId ?? 'isolated';
            const defaultProfileMismatch =
              defaultProfileId !== undefined &&
              effective !== 'isolated' &&
              effective !== defaultProfileId;
            const unsafeSharedDrm =
              site.drm &&
              defaultProfileId === undefined &&
              effective !== 'isolated';
            const profileWarning = defaultProfileMismatch
              ? messages.defaultProfileMismatchWarning.replace(
                '{profile}',
                profileName(defaultProfileId, allProfiles),
              )
              : unsafeSharedDrm
                ? messages.drmProfileWarning
                : undefined;
            return (
              <div className="profile-site-row" key={site.id}>
                <div className="profile-site-copy">
                  <Text weight="semibold">{site.title}</Text>
                  <Text size="xs" tone={profileWarning ? 'danger' : 'muted'}>
                    {profileWarning
                      ? profileWarning
                      : profileAssignmentDescription(
                        messages,
                        effective,
                        allProfiles,
                      )}
                  </Text>
                </div>
                <div className="profile-site-controls">
                  <Select
                    disabled={saving}
                    label={messages.browserProfile}
                    options={profileOptions(messages, allProfiles)}
                    value={effective}
                    onValueChange={(browserProfileId) => {
                      const assignments = {
                        ...preferences.siteBrowserProfiles
                      };
                      const defaultValue = defaultProfileId ?? 'isolated';
                      if (browserProfileId === defaultValue) delete assignments[site.id];
                      else assignments[site.id] = browserProfileId;
                      onUpdate({
                        siteBrowserProfiles: assignments
                      });
                    }}
                  />
                  {effective === 'isolated' ? (
                    <Button
                      className="profile-clear-data-button"
                      disabled={saving || dataActionsDisabled || Boolean(dataActionId)}
                      isLoading={dataActionId === `site:${site.id}`}
                      size="sm"
                      variant="secondary"
                      onClick={() => void onClearIsolatedSiteData(site)}
                    >
                      {messages.clearSiteData}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </Stack>
      </section>

      <section>
        <Stack gap="sm">
          <div className="application-data-row">
            <div className="application-data-copy">
              <Text weight="semibold">{messages.restoreDefaultProfiles}</Text>
              <Text size="xs" tone="muted">
                {messages.restoreDefaultProfilesDescription}
              </Text>
            </div>
            <Button
              disabled={
                saving ||
                Object.keys(preferences.siteBrowserProfiles).length === 0
              }
              size="sm"
              variant="secondary"
              onClick={() => onUpdate({
                siteBrowserProfiles: {}
              })}
            >
              {messages.restoreDefaultProfiles}
            </Button>
          </div>
          <div className="application-data-row is-danger">
            <div className="application-data-copy">
              <Text weight="semibold">{messages.allProfileDataClear}</Text>
              <Text size="xs" tone="muted">
                {messages.allProfileDataClearDescription}
              </Text>
            </div>
            <Button
              disabled={saving || dataActionsDisabled || Boolean(dataActionId)}
              isLoading={dataActionId === 'all-browser-profiles'}
              size="sm"
              variant="danger"
              onClick={() => void onClearAllBrowserProfiles()}
            >
              {messages.allProfileDataClear}
            </Button>
          </div>
        </Stack>
      </section>
    </Stack>
  );
}

/** Performs the browser profile card operation. */
export function BrowserProfileCard({
  clearDisabled,
  clearLoading,
  messages,
  profile,
  removeDisabled,
  onClear,
  onRemove,
}: {
  /** Whether the clear disabled option is enabled. */
  readonly clearDisabled?: boolean;
  /** Whether the clear loading option is enabled. */
  readonly clearLoading?: boolean;
  /** The messages value. */
  readonly messages: AppMessages;
  /** The profile value. */
  readonly profile: BrowserProfileInfo;
  /** Whether the remove disabled option is enabled. */
  readonly removeDisabled?: boolean;
  /** Callback used to handle on clear. */
  readonly onClear: () => void;
  /** Callback used to handle on remove. */
  readonly onRemove?: () => void;
}
) {
  return (
    <div className="browser-profile-card">
      <div>
        <Flex align="center" gap="sm">
          <Text weight="semibold">{profile.name}</Text>
          <span className={`profile-source-badge is-${profile.source}`}>
            {profile.source === 'plugin'
              ? messages.pluginProfile
              : messages.userProfile}
          </span>
        </Flex>
        <Text size="xs" tone="muted">
          {profile.description ?? profile.pluginName ?? messages.persistentProfile}
        </Text>
      </div>
      <div className="profile-card-actions">
        <Button
          className="profile-clear-data-button"
          disabled={clearDisabled}
          isLoading={clearLoading}
          size="sm"
          variant="secondary"
          onClick={onClear}
        >
          {messages.clearProfileData}
        </Button>
        {onRemove ? (
          <Button disabled={removeDisabled} size="sm" variant="danger" onClick={onRemove}>
            {messages.removeProfile}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
