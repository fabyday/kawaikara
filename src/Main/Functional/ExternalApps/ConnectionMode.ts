/**
 * Selects the companion transport at process startup; never falls back between permission stores.
 * @param packaged Whether the Kawaikara host is packaged. Packaged hosts always use installed apps.
 * @param requested Explicit local testing override: installed or development.
 * @returns Whether authenticated development discovery/transport should run.
 * @throws Unknown overrides and attempts to enable development discovery in packaged hosts.
 */
export function useDevelopmentExternalApps(
    packaged: boolean,
    requested?: string,
): boolean {
    if (
        requested !== undefined &&
        requested !== 'installed' &&
        requested !== 'development'
    )
        throw new Error(
            'KAWAIKARA_EXTERNAL_APP_MODE must be installed or development.',
        );
    if (packaged && requested === 'development')
        throw new Error(
            'Development external apps require a development Kawaikara host.',
        );
    return !packaged && requested !== 'installed';
}
