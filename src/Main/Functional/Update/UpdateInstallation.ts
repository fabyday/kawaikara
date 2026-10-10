/** Defines reversible work performed immediately before handing off to the installer. */
export interface UpdateInstallLifecycle {
    /** Saves pending data and releases native resources without disposing the application. */
    prepare(): Promise<void>;
    /** Restores interactive resources if preparation or installer startup fails. */
    recover(): Promise<void>;
}
