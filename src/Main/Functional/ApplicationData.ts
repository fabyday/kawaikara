import { app, dialog, type Session } from 'electron';
import type { AppLocale } from '../../Common/IPC';

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
  const language = resolveLanguage(locale);
  const copy: ConfirmationCopy = language === 'ko'
    ? {
        title: '모든 프로필 데이터 삭제',
        message: '모든 브라우저 프로필의 로그인 및 캐시 데이터를 삭제할까요?',
        detail: '격리, Bundle 및 사용자 프로필의 쿠키, 로컬 저장소, IndexedDB와 캐시가 삭제됩니다. 설정과 Bundle은 유지되며 이 작업은 되돌릴 수 없습니다.',
        cancel: '취소',
        confirm: '모두 삭제',
      }
    : language === 'ja'
      ? {
          title: 'すべてのプロファイルデータを削除',
          message: 'すべてのブラウザープロファイルのログイン情報とキャッシュを削除しますか？',
          detail: '分離、Bundle、ユーザープロファイルのCookie、ローカルストレージ、IndexedDB、キャッシュが削除されます。設定とBundleは保持され、この操作は元に戻せません。',
          cancel: 'キャンセル',
          confirm: 'すべて削除',
        }
      : {
          title: 'Clear all profile data',
          message: 'Clear sign-in and cached data from every browser profile?',
          detail: 'Cookies, local storage, IndexedDB, and caches in isolated, Bundle, and user profiles will be removed. Preferences and Bundles are kept. This cannot be undone.',
          cancel: 'Cancel',
          confirm: 'Clear all',
        };
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
  const language = resolveLanguage(locale);
  if (language === 'ko') {
    return {
      /** The title value. */
      title: kind === 'profile' ? '프로필 데이터 삭제' : '사이트 데이터 삭제',
      /** The message value. */
      message: `${name}의 로그인 및 캐시 데이터를 삭제할까요?`,
      /** The detail value. */
      detail: '쿠키, 로컬 저장소, IndexedDB와 캐시가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
      /** Whether the cancel option is enabled. */
      cancel: '취소',
      /** The confirm value. */
      confirm: '데이터 삭제',
    };
  }
  if (language === 'ja') {
    return {
      /** The title value. */
      title: kind === 'profile' ? 'プロファイルデータを削除' : 'サイトデータを削除',
      /** The message value. */
      message: `${name}のログイン情報とキャッシュを削除しますか？`,
      /** The detail value. */
      detail: 'Cookie、ローカルストレージ、IndexedDB、キャッシュが削除されます。この操作は元に戻せません。',
      /** Whether the cancel option is enabled. */
      cancel: 'キャンセル',
      /** The confirm value. */
      confirm: 'データを削除',
    };
  }
  return {
    /** The title value. */
    title: kind === 'profile' ? 'Clear profile data' : 'Clear site data',
    /** The message value. */
    message: `Clear sign-in and cached data for ${name}?`,
    /** The detail value. */
    detail: 'Cookies, local storage, IndexedDB, and caches will be removed. This cannot be undone.',
    /** Whether the cancel option is enabled. */
    cancel: 'Cancel',
    /** The confirm value. */
    confirm: 'Clear data',
  };
}

/** Resets the confirmation copy. */
function resetConfirmationCopy(
  kind: ResetKind,
  locale: AppLocale,
): ConfirmationCopy {
  const language = resolveLanguage(locale);
  if (language === 'ko') {
    return kind === 'cache'
      ? {
          /** The title value. */
          title: '캐시 초기화',
          /** The message value. */
          message: 'Electron 캐시를 삭제하고 Kawaikara를 재시작할까요?',
          /** The detail value. */
          detail: '로그인, 설정, 사용자 Bundle과 로컬 기록은 유지됩니다.',
          /** Whether the cancel option is enabled. */
          cancel: '취소',
          /** The confirm value. */
          confirm: '삭제 후 재시작',
        }
      : {
          /** The title value. */
          title: '앱 초기화',
          /** The message value. */
          message: 'Kawaikara의 모든 앱 데이터를 삭제할까요?',
          /** The detail value. */
          detail: '설정, 로그인, 브라우저 프로필 데이터, 사용자 Bundle, 로그와 로컬 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
          /** Whether the cancel option is enabled. */
          cancel: '취소',
          /** The confirm value. */
          confirm: '초기화 후 재시작',
        };
  }
  if (language === 'ja') {
    return kind === 'cache'
      ? {
          /** The title value. */
          title: 'キャッシュをリセット',
          /** The message value. */
          message: 'Electronのキャッシュを削除してKawaikaraを再起動しますか？',
          /** The detail value. */
          detail: 'ログイン、設定、ユーザーBundle、ローカル履歴は保持されます。',
          /** Whether the cancel option is enabled. */
          cancel: 'キャンセル',
          /** The confirm value. */
          confirm: '削除して再起動',
        }
      : {
          /** The title value. */
          title: 'アプリをリセット',
          /** The message value. */
          message: 'Kawaikaraのすべてのアプリデータを削除しますか？',
          /** The detail value. */
          detail: '設定、ログイン、ブラウザープロファイル、ユーザーBundle、ログ、ローカル履歴が削除されます。この操作は元に戻せません。',
          /** Whether the cancel option is enabled. */
          cancel: 'キャンセル',
          /** The confirm value. */
          confirm: 'リセットして再起動',
        };
  }
  return kind === 'cache'
    ? {
        /** The title value. */
        title: 'Reset cache',
        /** The message value. */
        message: 'Clear Electron caches and restart Kawaikara?',
        /** The detail value. */
        detail: 'Sign-ins, preferences, user Bundles, and local history will be kept.',
        /** Whether the cancel option is enabled. */
        cancel: 'Cancel',
        /** The confirm value. */
        confirm: 'Clear and restart',
      }
    : {
        /** The title value. */
        title: 'Reset application',
        /** The message value. */
        message: 'Delete all Kawaikara application data?',
        /** The detail value. */
        detail: 'Preferences, sign-ins, browser profile data, user Bundles, logs, and local history will be removed. This cannot be undone.',
        /** Whether the cancel option is enabled. */
        cancel: 'Cancel',
        /** The confirm value. */
        confirm: 'Reset and restart',
      };
}

/** Resolves the language. */
function resolveLanguage(locale: AppLocale): 'en' | 'ja' | 'ko' {
  const resolved = locale === 'system' ? app.getLocale() : locale;
  const normalized = resolved.toLowerCase();
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('ja')) return 'ja';
  return 'en';
}
