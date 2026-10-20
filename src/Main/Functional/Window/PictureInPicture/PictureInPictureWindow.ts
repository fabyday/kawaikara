import { app, BrowserWindow, type Rectangle } from 'electron';
import {
    preparePictureInPicturePresentation,
    configurePictureInPictureWindow,
    shouldHidePictureInPictureFromTaskbar,
} from '../../../Platform/Presentation';
import { PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM } from '../../../../Common/PictureInPicture';
import { getLocaleMessages } from '../../Localization/Locale';
import type { AppLocale } from '../../../../Common/IPC';
import type { LoggingManager } from '../../../Manager/LoggingManager';

/**
 * Creates and configures a hidden native host for a unified PiP session.
 *
 * @param bounds - Initial native window rectangle in Electron device-independent pixels.
 * @param aspectRatio - Optional width/height ratio; only finite positive values are applied.
 * @param locale - Application locale used for the window title; system uses Electron's locale.
 * @param logging - Service that attaches renderer logging to the new host.
 * @returns A hidden, frameless, always-on-top BrowserWindow with the platform PiP policy applied.
 * @remarks The caller owns media attachment, showing the window, event subscriptions
 * and eventual destruction. This function does not create a Provider media session.
 */
export function createPictureInPictureWindow(
    bounds: Rectangle,
    aspectRatio: number | undefined,
    locale: AppLocale,
    logging: Pick<LoggingManager, 'attachRenderer'>,
): BrowserWindow {
    preparePictureInPicturePresentation();
    const pipWindow = new BrowserWindow({
        ...bounds,
        show: false,
        frame: false,
        title: getLocaleMessages(locale, app.getLocale()).nativeDialogs
            .pipWindowTitle,
        backgroundColor: '#000000',
        alwaysOnTop: true,
        resizable: true,
        movable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: shouldHidePictureInPictureFromTaskbar(),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    logging.attachRenderer(pipWindow.webContents, 'rendererPictureInPicture');
    pipWindow.setMenu(null);
    pipWindow.setMenuBarVisibility(false);
    pipWindow.setMinimumSize(
        PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.width,
        PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.height,
    );
    if (aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0) {
        pipWindow.setAspectRatio(aspectRatio);
    }
    configurePictureInPictureWindow(pipWindow);
    return pipWindow;
}
