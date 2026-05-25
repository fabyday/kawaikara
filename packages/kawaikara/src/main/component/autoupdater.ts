import { BrowserWindow } from 'electron';
import log from 'electron-log/main';
import {
    autoUpdater,
    CancellationToken,
    ProgressInfo,
    UpdateInfo,
} from 'electron-updater';
import {
    closeUpdateView,
    getUpdateState,
    openUpdateView,
    setUpdateState,
} from './update_view';

log.transports.file.level = 'debug';
autoUpdater.autoDownload = false;
autoUpdater.logger = log;
log.info('updater App starting...');

let listenersBound = false;
let updateInfo: UpdateInfo | null = null;
let cancellationToken: CancellationToken | null = null;

function describeUpdate(info?: UpdateInfo | null) {
    if (!info?.version) {
        return undefined;
    }
    return info.version;
}

function setProgress(progress: ProgressInfo) {
    setUpdateState({
        stage: 'downloading',
        title: 'Downloading update',
        message: 'Keep the app open while the update is downloaded.',
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
        canCancel: true,
        canClose: false,
        canDownload: false,
        canInstall: false,
    });
}

const on_checking_for_update = () => {
    openUpdateView();
    setUpdateState({
        stage: 'checking',
        title: 'Checking for updates',
        message: 'Looking for the newest Kawaikara release.',
        percent: undefined,
        canDownload: false,
        canCancel: false,
        canInstall: false,
        canClose: false,
    });
};

const on_update_available = (info: UpdateInfo) => {
    updateInfo = info;
    openUpdateView();
    setUpdateState({
        stage: 'available',
        title: 'Update available',
        message: 'A new version is ready to download.',
        version: describeUpdate(info),
        percent: 0,
        canDownload: true,
        canCancel: false,
        canInstall: false,
        canClose: true,
    });
};

const on_update_not_available = () => {
    openUpdateView();
    setUpdateState({
        stage: 'not_available',
        title: 'No update available',
        message: 'You are already using the latest available version.',
        percent: undefined,
        canDownload: false,
        canCancel: false,
        canInstall: false,
        canClose: true,
    });
};

const on_update_downloaded = (info: UpdateInfo) => {
    updateInfo = info;
    cancellationToken = null;
    openUpdateView();
    setUpdateState({
        stage: 'downloaded',
        title: 'Update ready',
        message: 'Restart Kawaikara to install the downloaded update.',
        version: describeUpdate(info),
        percent: 100,
        canDownload: false,
        canCancel: false,
        canInstall: true,
        canClose: true,
    });
};

const on_update_cancelled = (info: UpdateInfo) => {
    updateInfo = info;
    cancellationToken = null;
    openUpdateView();
    setUpdateState({
        stage: 'cancelled',
        title: 'Update cancelled',
        message: 'The update download was cancelled.',
        version: describeUpdate(info),
        canDownload: true,
        canCancel: false,
        canInstall: false,
        canClose: true,
    });
};

const on_error = (error: Error) => {
    const state = getUpdateState();
    if (cancellationToken?.cancelled || state.stage === 'cancelled') {
        cancellationToken = null;
        return;
    }

    cancellationToken = null;
    openUpdateView();
    setUpdateState({
        stage: 'error',
        title: 'Update failed',
        message: error?.message ?? 'Unknown update error.',
        canDownload: Boolean(updateInfo),
        canCancel: false,
        canInstall: false,
        canClose: true,
    });
};

const on_download_progress = (progress: ProgressInfo) => {
    setProgress(progress);
};

function ensureUpdaterListeners() {
    if (listenersBound) {
        return;
    }

    autoUpdater.on('checking-for-update', on_checking_for_update);
    autoUpdater.on('update-available', on_update_available);
    autoUpdater.on('update-not-available', on_update_not_available);
    autoUpdater.on('download-progress', on_download_progress);
    autoUpdater.on('update-downloaded', on_update_downloaded);
    autoUpdater.on('update-cancelled', on_update_cancelled);
    autoUpdater.on('error', on_error);
    listenersBound = true;
}

export function setup_pogress_bar(window: BrowserWindow) {
    autoUpdater.on('download-progress', (progress) => {
        window.setProgressBar(progress.percent * 0.01);
    });
    autoUpdater.on('update-downloaded', () => {
        window.setProgressBar(-1);
    });
    autoUpdater.on('update-cancelled', () => {
        window.setProgressBar(-1);
    });
    autoUpdater.on('error', () => {
        window.setProgressBar(-1);
    });
}

export function unset_autoupdater() {
    if (!listenersBound) {
        return;
    }

    autoUpdater.removeListener('checking-for-update', on_checking_for_update);
    autoUpdater.removeListener('update-available', on_update_available);
    autoUpdater.removeListener('update-not-available', on_update_not_available);
    autoUpdater.removeListener('download-progress', on_download_progress);
    autoUpdater.removeListener('update-downloaded', on_update_downloaded);
    autoUpdater.removeListener('update-cancelled', on_update_cancelled);
    autoUpdater.removeListener('error', on_error);
    listenersBound = false;
}

export function set_autoupdater() {
    ensureUpdaterListeners();
}

export function checkForUpdates() {
    ensureUpdaterListeners();
    openUpdateView();
    setUpdateState({
        stage: 'checking',
        title: 'Checking for updates',
        message: 'Looking for the newest Kawaikara release.',
        canDownload: false,
        canCancel: false,
        canInstall: false,
        canClose: false,
    });
    autoUpdater.checkForUpdates().catch(on_error);
}

export function startUpdateDownload() {
    ensureUpdaterListeners();
    if (cancellationToken !== null) {
        return;
    }

    cancellationToken = new CancellationToken();
    setUpdateState({
        stage: 'downloading',
        title: 'Downloading update',
        message: 'Preparing update download.',
        percent: 0,
        canDownload: false,
        canCancel: true,
        canInstall: false,
        canClose: false,
    });

    autoUpdater.downloadUpdate(cancellationToken).catch((error) => {
        if (cancellationToken?.cancelled) {
            cancellationToken = null;
            setUpdateState({
                stage: 'cancelled',
                title: 'Update cancelled',
                message: 'The update download was cancelled.',
                canDownload: true,
                canCancel: false,
                canInstall: false,
                canClose: true,
            });
            return;
        }
        on_error(error);
    });
}

export function cancelUpdate() {
    if (cancellationToken !== null) {
        cancellationToken.cancel();
        cancellationToken = null;
    }

    setUpdateState({
        stage: 'cancelled',
        title: 'Update cancelled',
        message: 'The update download was cancelled.',
        canDownload: Boolean(updateInfo),
        canCancel: false,
        canInstall: false,
        canClose: true,
    });
}

export function installUpdate() {
    setUpdateState({
        stage: 'downloaded',
        title: 'Installing update',
        message: 'Kawaikara will restart to apply the update.',
        canDownload: false,
        canCancel: false,
        canInstall: false,
        canClose: false,
    });
    setImmediate(() => autoUpdater.quitAndInstall());
}

export { closeUpdateView, getUpdateState };
