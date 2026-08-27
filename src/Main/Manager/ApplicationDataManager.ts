import { app, session } from 'electron';
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
import { requestUserDataReset } from '../Functional/UserDataPaths';
import type { SiteManager } from './SiteManager';

/** Coordinates application data behavior. */
export class ApplicationDataManager {
  /** The relaunch scheduled value. */
  private relaunchScheduled = false;

  /** Creates an instance of ApplicationDataManager. */
  constructor(
    /** The sites value. */
    private readonly sites: SiteManager,
  ) {}

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
