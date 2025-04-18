import { app } from 'electron';
import path from 'path';
import os from 'os';

export const script_root_path = path.resolve(__dirname, '../');

export const project_root = process.env.IS_DEV
    ? path.resolve(__dirname, '../..')
    : path.resolve(process.resourcesPath); // exe_dir_path/resources/

export const resources_root = process.env.IS_DEV
    ? path.resolve(__dirname, '../../resources')
    : path.resolve(process.resourcesPath); // exe_dir_path/resources/

export const data_root_path = process.env.IS_DEV
    ? path.resolve(__dirname, '../../config')
    : path.join(app.getPath('userData'));

export const download_root_path = process.env.IS_DEV
    ? path.resolve(__dirname, '../../download')
    : path.join(app.getPath('userData'), 'donwload');

export const plugin_root_path = process.env.IS_DEV
    ? path.resolve(__dirname, '../../plugins')
    : path.join(app.getPath('userData'));

export const log_root_path = process.env.IS_DEV
    ? path.resolve(project_root, 'logs')
    : process.platform === 'win32'
      ? path.resolve(project_root, 'logs')
      : path.resolve(os.homedir(), 'Library', 'Logs', 'kawaikara');

export const default_locale_directory = process.env.IS_DEV
    ? path.join(data_root_path, 'locales')
    : path.join(project_root, 'locales');

export const default_config_path = 'kawai-config.json';

export const default_app_states_path = 'kawai-states.json';

export const third_party_bin_path = path.resolve(
    project_root,
    `thirdparty/bin/${process.platform}`,
);
