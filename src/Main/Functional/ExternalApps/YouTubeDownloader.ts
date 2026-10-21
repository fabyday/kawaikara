import type { DevelopmentConnection } from './DevelopmentConnection';
import { KAWAI_DOWNLOADER_APP_ID } from '../../../Common/Download';
import type { ExternalAppHost } from './ExternalAppAdapter';
import { app, dialog, shell } from 'electron';
import type { AppLocale } from '../../../Common/IPC';
import { getLocaleMessages } from '../Localization/Locale';
import type {
    ExternalDownloaderInstallResult,
    ExternalDownloaderOpenResult,
    ExternalDownloaderStatus,
} from '../../../Common/Download';
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
} from '../../Platform/ExternalDownloader';
import { ExternalDownloaderCallbackServer } from '../External/ExternalDownloaderCallback';
import type { LoggingManager } from '../../Manager/LoggingManager';

/** Companion-specific discovery, installation and authenticated launch adapter. */
export class YouTubeDownloader {
    /** Scoped logger for installation, launch, and callback lifecycle events. */
    private readonly logger;
    /** Loopback callback endpoint used for bidirectional companion events. */
    private readonly callbacks;
    /**
     * Creates the companion service without starting a listener or launching a process.
     * @param getLocale - Reads the latest locale before each installation confirmation.
     * @param logging - Optional application logger; console is used when omitted.
     * @remarks Application composition shares one instance between the registry adapter and setup UI.
     */
    constructor(
        /** Reads the current app locale without caching a stale preference. */
        private readonly getLocale: () => AppLocale = () => 'system',
        logging?: LoggingManager,
        /** The development value. */
        private readonly development?: DevelopmentConnection,
    ) {
        this.logger = logging?.getLogger('externalDownloader') ?? console;
        this.callbacks = new ExternalDownloaderCallbackServer(this.logger);
    }
    /** The install promise value. */
    private installPromise?: Promise<ExternalDownloaderInstallResult>;

    /**
     * Requeries the native installation and available installer mechanism.
     * @param message - Optional presentation detail attached to this snapshot.
     * @returns Main/UI status including the native launch path; not exposed to Providers.
     * @throws Propagates unexpected native discovery errors.
     */
    async getStatus(message?: string): Promise<ExternalDownloaderStatus> {
        const platform = getExternalDownloaderPlatform();
        const installed: { version?: string; path?: string } | null = this.development
            ? (this.development.online(KAWAI_DOWNLOADER_APP_ID) ? {} : null)
            : await findInstalledExternalDownloaderApp();
        return {
            /** Whether this snapshot describes a running development connection. */
            development: Boolean(this.development),
            /** The installed value. */
            installed: Boolean(installed),
            /** The automatic install supported value. */
            automaticInstallSupported:
                !this.development && getExternalDownloaderInstallMethod() !== 'unsupported',
            /** The platform value. */
            platform,
            /** The version value. */
            version: installed?.version,
            /** The app path value. */
            appPath: installed?.path,
            /** The message value. */
            message: message ?? (this.development && !installed
                ? getLocaleMessages(this.getLocale(), app.getLocale()).app.externalApps.developmentWaiting
                : undefined),
        };
    }

    /**
     * Hands a safe HTTPS source to the companion with request-scoped callback credentials.
     * @param value - Untrusted source URL; credentials, ports and non-HTTPS URLs are rejected.
     * @param host - Optional permission-checked invocation resources exposed only over authenticated callbacks.
     * @returns Opened=false when absent, otherwise a handoff ID, not download completion.
     * @throws Invalid source, callback startup or launch failures. Failed launches cancel the callback.
     */
    async open(value: unknown, host?: ExternalAppHost): Promise<ExternalDownloaderOpenResult> {
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

        const callback = await this.callbacks.createRequest(host);
        const deepLink = createExternalDownloaderDeepLink(sourceUrl, callback);
        this.logger.info('Launching external downloader request.', {
            platform: status.platform,
            requestId: callback.requestId,
        });
        try {
            if (this.development) await this.development.launch(
                KAWAI_DOWNLOADER_APP_ID, deepLink, () => !host || host.hasPermission('source'),
            );
            else await launchExternalDownloader(deepLink, status.appPath);
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

    /**
     * Runs at most one installation confirmation/download operation at a time.
     * @param value - Optional HTTPS source opened after a successful installation.
     * @returns Shared in-flight result, including cancellation and native installer launch state.
     * @throws Validation, download and installation failures; the lock is released on rejection.
     * @remarks Concurrent callers share the first request, including its source URL.
     */
    install(value?: unknown): Promise<ExternalDownloaderInstallResult> {
        if (!this.installPromise) {
            this.installPromise = this.installOnce(value).finally(() => {
                this.installPromise = undefined;
            });
        }
        return this.installPromise;
    }

    /**
     * Opens the companion release page in the system browser.
     * @returns Completion of the OS handoff, not page loading.
     * @throws Propagates OS/browser handoff errors.
     */
    async openReleasePage(): Promise<void> {
        await shell.openExternal(EXTERNAL_DOWNLOADER_RELEASES_PAGE);
    }

    /**
     * Performs one user-approved installation and optional source handoff.
     * @param value - Optional source validated before showing any installation UI.
     * @returns Cancellation, unsupported-platform or installation/handoff outcome.
     * @throws Unexpected discovery, release validation, installation and launch errors.
     */
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

        if (this.development) {
            return {
              /** Whether the canceled option is enabled. */
              canceled: false,
              /** The installer started value. */
              installerStarted: false,
              /** The opened value. */
              opened: false,
              /** The status value. */
              status: current };
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
