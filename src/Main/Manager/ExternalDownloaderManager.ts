import { app, dialog, shell } from 'electron';
import type { AppLocale } from '../../Common/IPC';
import { getLocaleMessages } from '../Functional/Localization/Locale';
import type {
    ExternalDownloaderInstallResult,
    ExternalDownloaderOpenResult,
    ExternalDownloaderStatus,
} from '../../Common/Download';
import {
    createExternalDownloaderDeepLink,
    installExternalDownloaderArtifact,
    getExternalDownloaderInstallMethod,
    launchExternalDownloader,
    EXTERNAL_DOWNLOADER_APP_NAME,
    EXTERNAL_DOWNLOADER_RELEASES_PAGE,
    fetchExternalDownloaderReleaseManifest,
    findInstalledExternalDownloaderApp,
    getExternalDownloaderPlatform,
    requireExternalDownloaderSourceUrl,
    selectExternalDownloaderArtifact,
} from '../Platform/External/ExternalDownloader';
import { ExternalDownloaderCallbackServer } from '../Functional/External/ExternalDownloaderCallback';
import type { LoggingManager } from './LoggingManager';

/** Coordinates external downloader behavior. */
export class ExternalDownloaderManager {
    /** Scoped logger for installation, launch, and callback lifecycle events. */
    private readonly logger;
    /** Loopback callback endpoint used for bidirectional companion events. */
    private readonly callbacks;
    /** Reads the current application preference at the start of each operation. */
    constructor(
        /** Reads the current app locale without caching a stale preference. */
        private readonly getLocale: () => AppLocale = () => 'system',
        logging?: LoggingManager,
    ) {
        this.logger = logging?.getLogger('externalDownloader') ?? console;
        this.callbacks = new ExternalDownloaderCallbackServer(this.logger);
    }
    /** The install promise value. */
    private installPromise?: Promise<ExternalDownloaderInstallResult>;

    /** Returns the status. */
    async getStatus(message?: string): Promise<ExternalDownloaderStatus> {
        const platform = getExternalDownloaderPlatform();
        const installed = await findInstalledExternalDownloaderApp(platform);
        return {
            /** The installed value. */
            installed: Boolean(installed),
            /** The automatic install supported value. */
            automaticInstallSupported:
                getExternalDownloaderInstallMethod() !== 'unsupported',
            /** The platform value. */
            platform,
            /** The version value. */
            version: installed?.version,
            /** The app path value. */
            appPath: installed?.path,
            /** The message value. */
            message,
        };
    }

    /** Opens the operation. */
    async open(value: unknown): Promise<ExternalDownloaderOpenResult> {
        const sourceUrl = requireExternalDownloaderSourceUrl(value);
        const status = await this.getStatus();
        if (!status.installed) {
            this.logger.warn(
                'External downloader launch skipped because it is not installed.',
            );
            return {
                /** The opened value. */
                opened: false,
                /** The status value. */
                status,
            };
        }

        const callback = await this.callbacks.createRequest();
        const deepLink = createExternalDownloaderDeepLink(sourceUrl, callback);
        this.logger.info('Launching external downloader request.', {
            platform: status.platform,
            requestId: callback.requestId,
        });
        try {
            await launchExternalDownloader(deepLink, status.appPath);
        } catch (error) {
            this.callbacks.cancel(callback.requestId);
            this.logger.error('Failed to launch external downloader.', {
                error,
                requestId: callback.requestId,
            });
            throw error;
        }
        this.logger.info('External downloader launch completed.', {
            requestId: callback.requestId,
        });
        return {
            /** The opened value. */
            opened: true,
            /** The callback request ID value. */
            requestId: callback.requestId,
            /** The status value. */
            status,
        };
    }

    /** Installs the operation. */
    install(value?: unknown): Promise<ExternalDownloaderInstallResult> {
        if (!this.installPromise) {
            this.installPromise = this.installOnce(value).finally(() => {
                this.installPromise = undefined;
            });
        }
        return this.installPromise;
    }

    /** Opens the release page. */
    async openReleasePage(): Promise<void> {
        await shell.openExternal(EXTERNAL_DOWNLOADER_RELEASES_PAGE);
    }

    /** Installs the once. */
    private async installOnce(
        value?: unknown,
    ): Promise<ExternalDownloaderInstallResult> {
        const labels = getLocaleMessages(
            this.getLocale(),
            app.getLocale(),
        ).downloader;
        const sourceUrl =
            value === undefined || value === ''
                ? undefined
                : requireExternalDownloaderSourceUrl(value);
        const current = await this.getStatus();
        if (current.installed) {
            const openResult = sourceUrl
                ? await this.open(sourceUrl)
                : { opened: false, status: current };
            return {
                /** Whether the canceled option is enabled. */
                canceled: false,
                /** The installer started value. */
                installerStarted: false,
                /** The opened value. */
                opened: openResult.opened,
                /** The status value. */
                status: openResult.status,
            };
        }

        if (!current.automaticInstallSupported) {
            return {
                /** Whether the canceled option is enabled. */
                canceled: false,
                /** The installer started value. */
                installerStarted: false,
                /** The opened value. */
                opened: false,
                /** The status value. */
                status: await this.getStatus(labels.unsupported),
            };
        }

        const confirmation = await dialog.showMessageBox({
            type: 'warning',
            title: labels.installTitle.replace(
                '{name}',
                EXTERNAL_DOWNLOADER_APP_NAME,
            ),
            message: labels.installMessage.replace(
                '{name}',
                EXTERNAL_DOWNLOADER_APP_NAME,
            ),
            detail:
                getExternalDownloaderInstallMethod() === 'copy-application'
                    ? labels.macInstallDetail
                    : labels.windowsInstallDetail,
            buttons: [labels.confirmInstall, labels.cancel],
            defaultId: 0,
            cancelId: 1,
            noLink: true,
        });
        if (confirmation.response !== 0) {
            return {
                /** Whether the canceled option is enabled. */
                canceled: true,
                /** The installer started value. */
                installerStarted: false,
                /** The opened value. */
                opened: false,
                /** The status value. */
                status: current,
            };
        }

        const manifest = await fetchExternalDownloaderReleaseManifest();
        const artifact = selectExternalDownloaderArtifact(
            manifest,
            current.platform,
            process.arch,
        );
        const installed = await installExternalDownloaderArtifact(
            manifest,
            artifact,
        );
        if (!installed.installerStarted) {
            const status = await this.getStatus(
                labels.completed.replace(
                    '{version}',
                    installed.version ?? manifest.version,
                ),
            );
            const openResult = sourceUrl
                ? await this.open(sourceUrl)
                : { opened: false, status };
            return {
                /** Whether the canceled option is enabled. */
                canceled: false,
                /** The installer started value. */
                installerStarted: false,
                /** The opened value. */
                opened: openResult.opened,
                /** The status value. */
                status: {
                    ...openResult.status,
                    /** The message value. */
                    message: status.message,
                },
            };
        }

        return {
            /** Whether the canceled option is enabled. */
            canceled: false,
            /** The installer started value. */
            installerStarted: true,
            /** The opened value. */
            opened: false,
            /** The status value. */
            status: await this.getStatus(labels.windowsStarted),
        };
    }
}
