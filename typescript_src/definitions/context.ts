import { BrowserView, BrowserWindow } from 'electron';
import {
    KawaiConfig,
    KawaiLocale,
} from './setting_types';

import { KawaiAbstractSiteDescriptor } from './SiteDescriptor';

type KawaiWindowMode = 'pip' | 'fullscreen' | 'default';
type KawaiId = string;

// KawaiContext Will be saved when quit app.
export type KawaiContext = {
    window_mode?: KawaiWindowMode;
    current_site_descriptor?: KawaiAbstractSiteDescriptor;
    current_window_bounds?: Electron.Rectangle;
};

export type GlobalObject = {
    mainWindow?: BrowserWindow;
    taskWindow?: BrowserWindow;
    preferenceWindow?: BrowserWindow;
    menu?: BrowserView;
    config?: KawaiConfig;
    locale?: KawaiLocale;
    context?: KawaiContext;
};
