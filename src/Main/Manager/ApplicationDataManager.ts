import { app, dialog, session, type Session } from 'electron';
import type {
  AppLocale,
  ApplicationDataActionResult,
} from '../../Common/IPC';
import { requestUserDataReset } from '../Functional/UserDataPaths';
import type { SiteManager } from './SiteManager';

type ClearTargetKind = 'profile' | 'site';
type ResetKind = 'cache' | 'application';

interface ConfirmationCopy {
  readonly cancel: string;
  readonly confirm: string;
  readonly detail: string;
  readonly message: string;
  readonly title: string;
}

export class ApplicationDataManager {
  private relaunchScheduled = false;

  constructor(private readonly sites: SiteManager) {}

  async clearBrowserProfile(
    profileId: string,
    locale: AppLocale,
  ): Promise<ApplicationDataActionResult> {
    const target = this.sites.resolveBrowserProfileDataTarget(profileId);
    if (!target) throw new Error(`Unknown browser profile: ${profileId}`);
    if (!(await confirmClear('profile', target.name, locale))) {
      return { status: 'cancelled' };
    }
    await this.sites.withPartitionSuspended(target.partition, () =>
      clearSessionStorage(session.fromPartition(target.partition)),
    );
    return { status: 'cleared' };
  }

  async clearIsolatedSite(
    siteId: string,
    locale: AppLocale,
  ): Promise<ApplicationDataActionResult> {
    const target = this.sites.resolveIsolatedSiteDataTarget(siteId);
    if (!target) {
      throw new Error(`Site ${siteId} is not using an isolated profile.`);
    }
    if (!(await confirmClear('site', target.name, locale))) {
      return { status: 'cancelled' };
    }
    await this.sites.withPartitionSuspended(target.partition, () =>
      clearSessionStorage(session.fromPartition(target.partition)),
    );
    return { status: 'cleared' };
  }

  async clearApplicationCache(
    locale: AppLocale,
  ): Promise<ApplicationDataActionResult> {
    if (!(await confirmReset('cache', locale))) return { status: 'cancelled' };
    const sessions = [
      session.defaultSession,
      ...this.sites
        .listBrowserDataPartitions()
        .map((partition) => session.fromPartition(partition)),
    ];
    await Promise.all([...new Set(sessions)].map(clearSessionCaches));
    requestUserDataReset('cache');
    this.scheduleRelaunch();
    return { status: 'restarting' };
  }

  async resetApplication(
    locale: AppLocale,
  ): Promise<ApplicationDataActionResult> {
    if (!(await confirmReset('application', locale))) {
      return { status: 'cancelled' };
    }
    requestUserDataReset('application');
    this.scheduleRelaunch();
    return { status: 'restarting' };
  }

  private scheduleRelaunch(): void {
    if (this.relaunchScheduled) return;
    this.relaunchScheduled = true;
    // Let ipcRenderer receive the result and render the restart state first.
    setTimeout(() => {
      app.relaunch();
      app.quit();
    }, 500);
  }
}

async function clearSessionStorage(target: Session): Promise<void> {
  await target.clearCache();
  await target.clearCodeCaches({});
  await target.clearStorageData();
  await target.clearAuthCache();
  await target.clearHostResolverCache();
  target.flushStorageData();
}

async function clearSessionCaches(target: Session): Promise<void> {
  await target.clearCache();
  await target.clearCodeCaches({});
  await target.clearHostResolverCache();
}

async function confirmClear(
  kind: ClearTargetKind,
  name: string,
  locale: AppLocale,
): Promise<boolean> {
  const copy = clearConfirmationCopy(kind, name, locale);
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

async function confirmReset(kind: ResetKind, locale: AppLocale): Promise<boolean> {
  const copy = resetConfirmationCopy(kind, locale);
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

function clearConfirmationCopy(
  kind: ClearTargetKind,
  name: string,
  locale: AppLocale,
): ConfirmationCopy {
  const language = resolveLanguage(locale);
  if (language === 'ko') {
    return {
      title: kind === 'profile' ? '프로필 데이터 삭제' : '사이트 데이터 삭제',
      message: `${name}의 로그인 및 캐시 데이터를 삭제할까요?`,
      detail: '쿠키, 로컬 저장소, IndexedDB와 캐시가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
      cancel: '취소',
      confirm: '데이터 삭제',
    };
  }
  if (language === 'ja') {
    return {
      title: kind === 'profile' ? 'プロファイルデータを削除' : 'サイトデータを削除',
      message: `${name}のログイン情報とキャッシュを削除しますか？`,
      detail: 'Cookie、ローカルストレージ、IndexedDB、キャッシュが削除されます。この操作は元に戻せません。',
      cancel: 'キャンセル',
      confirm: 'データを削除',
    };
  }
  return {
    title: kind === 'profile' ? 'Clear profile data' : 'Clear site data',
    message: `Clear sign-in and cached data for ${name}?`,
    detail: 'Cookies, local storage, IndexedDB, and caches will be removed. This cannot be undone.',
    cancel: 'Cancel',
    confirm: 'Clear data',
  };
}

function resetConfirmationCopy(
  kind: ResetKind,
  locale: AppLocale,
): ConfirmationCopy {
  const language = resolveLanguage(locale);
  if (language === 'ko') {
    return kind === 'cache'
      ? {
          title: '캐시 초기화',
          message: 'Electron 캐시를 삭제하고 Kawaikara를 재시작할까요?',
          detail: '로그인, 설정, 사용자 Bundle과 로컬 기록은 유지됩니다.',
          cancel: '취소',
          confirm: '삭제 후 재시작',
        }
      : {
          title: '앱 초기화',
          message: 'Kawaikara의 모든 앱 데이터를 삭제할까요?',
          detail: '설정, 로그인, 브라우저 프로필 데이터, 사용자 Bundle, 로그와 로컬 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
          cancel: '취소',
          confirm: '초기화 후 재시작',
        };
  }
  if (language === 'ja') {
    return kind === 'cache'
      ? {
          title: 'キャッシュをリセット',
          message: 'Electronのキャッシュを削除してKawaikaraを再起動しますか？',
          detail: 'ログイン、設定、ユーザーBundle、ローカル履歴は保持されます。',
          cancel: 'キャンセル',
          confirm: '削除して再起動',
        }
      : {
          title: 'アプリをリセット',
          message: 'Kawaikaraのすべてのアプリデータを削除しますか？',
          detail: '設定、ログイン、ブラウザープロファイル、ユーザーBundle、ログ、ローカル履歴が削除されます。この操作は元に戻せません。',
          cancel: 'キャンセル',
          confirm: 'リセットして再起動',
        };
  }
  return kind === 'cache'
    ? {
        title: 'Reset cache',
        message: 'Clear Electron caches and restart Kawaikara?',
        detail: 'Sign-ins, preferences, user Bundles, and local history will be kept.',
        cancel: 'Cancel',
        confirm: 'Clear and restart',
      }
    : {
        title: 'Reset application',
        message: 'Delete all Kawaikara application data?',
        detail: 'Preferences, sign-ins, browser profile data, user Bundles, logs, and local history will be removed. This cannot be undone.',
        cancel: 'Cancel',
        confirm: 'Reset and restart',
      };
}

function resolveLanguage(locale: AppLocale): 'en' | 'ja' | 'ko' {
  const resolved = locale === 'system' ? app.getLocale() : locale;
  const normalized = resolved.toLowerCase();
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('ja')) return 'ja';
  return 'en';
}
