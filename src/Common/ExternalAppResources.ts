/** Validates only the safe transport envelope, never downloader support policy. */
export function isExternalAppSourceUrl(value: string): boolean {
    if (!value || value.length > 16_384) return false;
    try {
        const url = new URL(value);
        return (
            url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            !url.port
        );
    } catch {
        return false;
    }
}

/** Trusted Main-to-overlay request. Presentation does not grant executable or installer authority. */
export interface ExternalAppSetupRequest {
    /** Registered Provider distribution source, resolved by Main. */
    readonly distributionUrl?: string;
    /** App selected by the Provider's trusted adapter. */
    readonly appId: string;
    /** Provider that initiated the request. */
    readonly providerId: string;
    /** Already validated source passed back through the normal permission boundary on retry. */
    readonly sourceUrl: string;
}
