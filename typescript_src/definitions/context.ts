import { BrowserView, BrowserWindow } from 'electron';
import { KawaiConfig, KawaiLocale } from './setting_types';

import { KawaiAbstractSiteDescriptor } from './SiteDescriptor';

type KawaiWindowMode = 'pip' | 'fullscreen' | 'default' | 'always_on_top';
type KawaiId = string;

// KawaiContext Will be saved when quit app.
export type KawaiContext = {
    window_mode?: KawaiWindowMode;
    current_site_descriptor?: KawaiAbstractSiteDescriptor;
    current_window_bounds?: Electron.Rectangle;
    saved_window_mode?: KawaiWindowMode;
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
