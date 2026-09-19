import { app, dialog, type Session } from 'electron';
import type { AppLocale } from '../../Common/IPC';
import { getClearAllProfilesConfirmationCopy, getLocaleMessages } from './Locale';

/** Defines the clear target kind type. */
type ClearTargetKind = 'profile' | 'site';
/** Defines the reset kind type. */
type ResetKind = 'cache' | 'application';

/** Describes the confirmation copy contract. */
interface ConfirmationCopy {
  /** Whether the cancel option is enabled. */
  readonly cancel: string;
  /** The confirm value. */
  readonly confirm: string;
  /** The detail value. */
  readonly detail: string;
  /** The message value. */
  readonly message: string;
  /** The title value. */
  readonly title: string;
}

/** Clears the session storage. */
export async function clearSessionStorage(target: Session): Promise<void> {
  await target.clearCache();
  await target.clearCodeCaches({});
  await target.clearStorageData();
  await target.clearAuthCache();
  await target.clearHostResolverCache();
  target.flushStorageData();
}

/** Clears the session caches. */
export async function clearSessionCaches(target: Session): Promise<void> {
  await target.clearCache();
  await target.clearCodeCaches({});
  await target.clearHostResolverCache();
}

/** Performs the confirm data clear operation. */
export async function confirmDataClear(
  kind: ClearTargetKind,
  name: string,
  locale: AppLocale,
): Promise<boolean> {
  const copy = clearConfirmationCopy(kind, name, locale);
  return showConfirmation(copy);
}

/** Performs the confirm data reset operation. */
export async function confirmDataReset(
  kind: ResetKind,
  locale: AppLocale,
): Promise<boolean> {
  const copy = resetConfirmationCopy(kind, locale);
  return showConfirmation(copy);
}

/** Performs the confirm clear all profiles operation. */
export async function confirmClearAllProfiles(
  locale: AppLocale,
): Promise<boolean> {
  const copy = getClearAllProfilesConfirmationCopy(locale, app.getLocale());
  return showConfirmation(copy);
}

/** Performs the show confirmation operation. */
async function showConfirmation(copy: ConfirmationCopy): Promise<boolean> {
  const result = await dialog.showMessageBox({
    buttons: [copy.cancel, copy.confirm],
    cancelId: 0,
    defaultId: 0,
    detail: copy.detail,
    message: copy.message,
    noLink: true,
    title: copy.title,
    type: 'warning',
  });
  return result.response === 1;
}

/** Clears the confirmation copy. */
function clearConfirmationCopy(
  kind: ClearTargetKind,
  name: string,
  locale: AppLocale,
): ConfirmationCopy {
  const messages = getLocaleMessages(locale, app.getLocale()).applicationData;
  const copy = kind === 'profile' ? messages.clearProfile : messages.clearSite;
  return {
    ...copy,
    /** Preserve the target name literally, including replacement-pattern characters. */
    message: copy.message.replace('{name}', () => name),
  };
}

/** Resets the confirmation copy. */
function resetConfirmationCopy(
  kind: ResetKind,
  locale: AppLocale,
): ConfirmationCopy {
  const messages = getLocaleMessages(locale, app.getLocale()).applicationData;
  return kind === 'cache' ? messages.resetCache : messages.resetApplication;
}
