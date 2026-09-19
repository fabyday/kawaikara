import type {
  AppMessages,
  BrowserProfileInfo
} from '../../../../Common/IPC';

/** Performs the profile options operation. */
export function profileOptions(
  messages: AppMessages,
  profiles: readonly BrowserProfileInfo[],
) {
  return [
    {
      /** The label value. */
      label: messages.isolatedProfile,
      /** The value value. */
      value: 'isolated',
    },
    ...profiles.map((profile) => ({
      label: `${profile.name} · ${profile.source === 'plugin' ? messages.pluginProfile : messages.userProfile
        }`,
      value: profile.id,
    })),
  ];
}

/** Performs the profile assignment description operation. */
export function profileAssignmentDescription(
  messages: AppMessages,
  profileId: string,
  profiles: readonly BrowserProfileInfo[],
): string {
  if (profileId === 'isolated') return messages.isolatedProfileDescription;
  const profile = profiles.find((item) => item.id === profileId);
  return profile
    ? messages.sharedProfileDescription.replace('{profile}', profile.name)
    : messages.isolatedProfileDescription;
}

/** Performs the profile name operation. */
export function profileName(
  profileId: string,
  profiles: readonly BrowserProfileInfo[],
): string {
  return profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
}

/** Creates the user browser profile ID. */
export function createUserBrowserProfileId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
