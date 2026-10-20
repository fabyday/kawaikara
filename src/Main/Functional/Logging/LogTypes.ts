import type { ApplicationLogSourceKey } from '../../../Common/Logging';
/** Defines a registered application log source key. */
export type ApplicationLogSourceId = ApplicationLogSourceKey;

/** Describes a staged native file-picker selection. */
export interface PendingLogImport {
    /** The selected absolute path values. */
    readonly filePaths: readonly string[];
    /** The selection creation timestamp value. */
    readonly createdAt: number;
}
