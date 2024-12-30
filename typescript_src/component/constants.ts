import { app } from "electron";
import path from "path";


export const script_root_path = path.resolve(__dirname, "../")

export const project_root = path.resolve(__dirname, "../..")

export const data_root_path = process.env.IS_DEV ? path.resolve(__dirname, "../../config") : path.join(app.getAppPath(), "kawaikara")

export const default_locale_directory = "locales"

export const default_config_path = "kawai-config.json" 

export const default_app_states_path ="kawai-states.json"