import { app, dialog, session } from 'electron';
import type {
  AppLocale,
  ApplicationDataActionResult,
} from '../../Common/IPC';
import {
  clearSessionCaches,
  clearSessionStorage,
  confirmClearAllProfiles,
  confirmDataClear,
  confirmDataReset,
} from '../Functional/ApplicationData';
import { getApplicationDataLocation, requestUserDataReset, resolveApplicationDataLocation, saveApplicationDataLocation } from '../Functional/UserDataPaths';
import { getAppMessages } from '../Functional/RendererMessages';
import type { SiteManager } from './SiteManager';

/** Coordinates application data behavior. */
export class ApplicationDataManager {
  /** The relaunch scheduled value. */
  private relaunchScheduled = false;
  /** Serializes location pick/apply interactions. */
  private locationChangePending = false;

  /** Creates an instance of ApplicationDataManager. */
  constructor(
    /** The sites value. */
    private readonly sites: SiteManager,
  ) {}

  /** Exposes Windows-only data storage capability to the app-owned UI. */
  getLocation() {
    return getApplicationDataLocation();
  }

  /** Uses Explorer's folder picker without modifying any data. */
  async selectLocation(locale: AppLocale): Promise<string | undefined> {
    const info = this.getLocation();
    const copy = getAppMessages(locale, app.getLocale()).appDataLocation;
    if (!info?.canChange) throw new Error(copy.unavailable);
    const result = await dialog.showOpenDialog({
      title: copy.chooseFolder,
      defaultPath: info.currentPath,
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? undefined : result.filePaths[0];
  }

  /** Confirm the exact effective root, write the locator, then restart normally. */
  async changeLocation(input: string, locale: AppLocale): Promise<ApplicationDataActionResult> {
    const copy = getAppMessages(locale, app.getLocale()).appDataLocation;
    if (!this.getLocation()?.canChange) throw new Error(copy.unavailable);
    if (this.locationChangePending || this.relaunchScheduled) throw new Error(copy.busy);
    this.locationChangePending = true;
    try {
      let target: string;
      try { target = resolveApplicationDataLocation(input); } catch { throw new Error(copy.invalidPath); }
      const result = await dialog.showMessageBox({
        type: 'warning',
        title: copy.label,
        message: copy.confirm,
        detail: `${target}\n\n${copy.warning}\n\n${copy.builtin}`,
        buttons: [copy.cancel, copy.apply],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (result.response !== 1) return {
        /** Cancellation keeps the existing startup pointer. */
        status: 'cancelled',
      };
      try { await saveApplicationDataLocation(target); } catch { throw new Error(copy.saveFailed); }
      this.scheduleRelaunch();
      return {
        /** The saved root takes effect in the next process. */
        status: 'restarting',
      };
    } finally { this.locationChangePending = false; }
  }

  /** Clears the browser profile. */
  async clearBrowserProfile(
    profileId: string,
    locale: AppLocale,
  ): Promise<ApplicationDataActionResult> {
    const target = this.sites.resolveBrowserProfileDataTarget(profileId);
    if (!target) throw new Error(`Unknown browser profile: ${profileId}`);
    if (!(await confirmDataClear('profile', target.name, locale))) {
      return {
        /** The status value. */
        status: 'cancelled',
      };
    }
    await this.sites.withPartitionSuspended(target.partition, () =>
      clearSessionStorage(session.fromPartition(target.partition)),
    );
    return {
      /** The status value. */
      status: 'cleared',
    };
  }

  /** Clears the isolated site. */
  async clearIsolatedSite(
    siteId: string,
    locale: AppLocale,
  ): Promise<ApplicationDataActionResult> {
    const target = this.sites.resolveIsolatedSiteDataTarget(siteId);
    if (!target) {
      throw new Error(`Site ${siteId} is not using an isolated profile.`);
    }
    if (!(await confirmDataClear('site', target.name, locale))) {
      return {
        /** The status value. */
        status: 'cancelled',
      };
    }
    await this.sites.withPartitionSuspended(target.partition, () =>
      clearSessionStorage(session.fromPartition(target.partition)),
    );
    return {
      /** The status value. */
      status: 'cleared',
    };
  }

  /** Clears the application cache. */
  async clearApplicationCache(
    locale: AppLocale,
  ): Promise<ApplicationDataActionResult> {
    if (!(await confirmDataReset('cache', locale))) return {
      /** The status value. */
      status: 'cancelled',
    };
    const sessions = [
      session.defaultSession,
      ...this.sites
        .listBrowserDataPartitions()
        .map((partition) => session.fromPartition(partition)),
    ];
    await Promise.all([...new Set(sessions)].map(clearSessionCaches));
    requestUserDataReset('cache');
    this.scheduleRelaunch();
    return {
      /** The status value. */
      status: 'restarting',
    };
  }

  /** Clears the all browser profiles. */
  async clearAllBrowserProfiles(
    locale: AppLocale,
  ): Promise<ApplicationDataActionResult> {
    if (!(await confirmClearAllProfiles(locale))) {
      return {
        /** The status value. */
        status: 'cancelled',
      };
    }
    for (const partition of this.sites.listBrowserDataPartitions()) {
      await this.sites.withPartitionSuspended(partition, () =>
        clearSessionStorage(session.fromPartition(partition)),
      );
    }
    return {
      /** The status value. */
      status: 'cleared',
    };
  }

  /** Resets the application. */
  async resetApplication(
    locale: AppLocale,
  ): Promise<ApplicationDataActionResult> {
    if (!(await confirmDataReset('application', locale))) {
      return {
        /** The status value. */
        status: 'cancelled',
      };
    }
    requestUserDataReset('application');
    this.scheduleRelaunch();
    return {
      /** The status value. */
      status: 'restarting',
    };
  }

  /** Schedules the relaunch. */
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
