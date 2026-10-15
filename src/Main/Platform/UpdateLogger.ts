/** Logging surface for native update verification. */
export interface UpdateLogger {
    /** Records an accepted native verification fallback. */
    info(message: string, detail?: unknown): void;
    /** Records failed native verification details. */
    warn(message: string, detail?: unknown): void;
}
