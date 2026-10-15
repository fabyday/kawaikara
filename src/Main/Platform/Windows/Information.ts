import os from 'node:os';
/** Return the Windows edition and kernel build. */
export function getOperatingSystemLabel(): string {
    const systemVersion = process.getSystemVersion();
    const release = os.release();
    const build = release.split('.')[2] || systemVersion.split('.')[2];
    const edition = os.version().startsWith('Windows ')
        ? os.version()
        : resolveWindowsName(build);
    return build ? `${edition} (build ${build})` : edition;
}
/** Resolves the Windows product family from a kernel build number. */
function resolveWindowsName(build: string | undefined): string {
    const buildNumber = Number(build);
    if (Number.isFinite(buildNumber) && buildNumber >= 22_000) {
        return 'Windows 11';
    }
    if (Number.isFinite(buildNumber) && buildNumber >= 10_240) {
        return 'Windows 10';
    }
    return 'Windows';
}
