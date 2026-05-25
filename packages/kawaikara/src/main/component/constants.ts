import { app } from 'electron';
import path from 'path';
import os from 'os';

const package_root = path.resolve(__dirname, '../..');
const workspace_root = path.resolve(package_root, '../..');
const app_resource_root = app.isPackaged
    ? path.resolve(process.resourcesPath)
    : workspace_root;
const app_bundle_root = app.isPackaged
    ? path.resolve(app.getAppPath())
    : package_root;

export const script_root_path = app.isPackaged
    ? path.resolve(app_bundle_root, 'dist')
    : path.resolve(__dirname, '..');

export const project_root = app_resource_root;

export const resources_root = app.isPackaged
    ? app_resource_root
    : path.resolve(workspace_root, 'resources');

export const data_root_path = app.isPackaged
    ? path.join(app.getPath('userData'))
    : path.resolve(workspace_root, 'config');

export const download_root_path = app.isPackaged
    ? path.join(app.getPath('userData'), 'download')
    : path.resolve(package_root, 'download');

export const plugin_root_path = app.isPackaged
    ? path.join(app.getPath('userData'), 'plugins')
    : path.resolve(package_root, 'plugins');

export const log_root_path =
    !app.isPackaged || process.platform === 'win32'
        ? path.resolve(project_root, 'logs')
        : path.resolve(os.homedir(), 'Library', 'Logs', 'kawaikara');

export const default_locale_directory = app.isPackaged
    ? path.join(project_root, 'locales')
    : path.join(data_root_path, 'locales');

export const default_config_path = 'kawai-config.json';

export const default_app_states_path = 'kawai-states.json';

export const third_party_bin_path = path.resolve(
    project_root,
    `thirdparty/bin/${process.platform}`,
);
