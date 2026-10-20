/** Defines the shared log max size bytes constant. */
export const LOG_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Defines the maximum number of parsed entries returned to the renderer. */
export const LOG_VIEWER_ENTRY_LIMIT = 5_000;

/** Defines the maximum accepted size of one imported log. */
export const IMPORTED_LOG_MAX_SIZE_BYTES = 16 * 1024 * 1024;

/** Defines the maximum number of selected inputs accepted from one picker operation. */
export const IMPORTED_LOG_INPUT_MAX_COUNT = 32;

/** Defines the maximum number of extracted logs stored by one import operation. */
export const IMPORTED_LOG_OUTPUT_MAX_COUNT = 128;

/** Defines the maximum combined UTF-8 log size stored by one import operation. */
export const IMPORTED_LOG_TOTAL_SIZE_BYTES = 64 * 1024 * 1024;

/** Defines the maximum retained length of one imported log line. */
export const IMPORTED_LOG_MAX_LINE_LENGTH = 65_536;

/** Defines the maximum accepted number of lines in one imported log. */
export const IMPORTED_LOG_MAX_LINE_COUNT = 200_000;

/** Defines the maximum visible size of one joined log message. */
export const LOG_VIEWER_MESSAGE_MAX_LENGTH = 256 * 1024;

/** Defines the external log repository directory name. */
export const EXTERNAL_LOG_DIRECTORY_NAME = 'external';

/** Defines the external group metadata file name. */
export const EXTERNAL_GROUP_METADATA_FILE_NAME = 'group.json';

/** Defines the virtual group containing legacy raw external logs. */
export const EXTERNAL_UNGROUPED_GROUP_ID = 'ungrouped';

/** Defines the persistent readable log device identity file name. */
export const LOG_DEVICE_ID_FILE_NAME = 'log-device.json';

/** Defines the maximum age of an unconfirmed import selection. */
export const PENDING_IMPORT_MAX_AGE_MS = 10 * 60 * 1_000;

/** Defines the structured metadata header prefix. */
export const LOG_METADATA_PREFIX = '#!kawaikara-log-v1 ';

/** Matches the beginning of an electron-log file line. */
export const LOG_ENTRY_PATTERN =
    /^\[([^\]]+)]\s+\[([^\]]+)]\s+(?:\(([^)]+)\)\s+)?(.*)$/;

/** Matches ANSI terminal control sequences in imported text. */
export const ANSI_ESCAPE_PATTERN =
    /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;

/** Matches unsafe control characters while preserving tabs and line breaks. */
export const UNSAFE_CONTROL_CHARACTER_PATTERN =
    /[\u0000-\u0008\u000b\u000c\u000e-\u001a\u001c-\u001f\u007f]/g;
