import { app } from 'electron';
import path from 'path';

export const script_root_path = path.resolve(__dirname, '../');

export const project_root = process.env.IS_DEV
    ? path.resolve(__dirname, '../..')
    : path.resolve(process.resourcesPath); // exe_dir_path/resources/

export const data_root_path = process.env.IS_DEV
    ? path.resolve(__dirname, '../../config')
    : path.join(app.getPath('userData'));

export const default_locale_directory = process.env.IS_DEV ? path.join(data_root_path, "locales") : path.join(project_root, 'locales');

export const default_config_path = 'kawai-config.json';

export const default_app_states_path = 'kawai-states.json';
