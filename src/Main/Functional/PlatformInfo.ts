import os from 'node:os';

/** Returns a user-facing operating system name with its release or build. */
export function getOperatingSystemLabel(): string {
  const systemVersion = process.getSystemVersion();
  if (process.platform === 'win32') {
    const release = os.release();
    const build = release.split('.')[2] || systemVersion.split('.')[2];
    const edition = os.version().startsWith('Windows ')
      ? os.version()
      : resolveWindowsName(build);
    return build ? `${edition} (build ${build})` : edition;
  }
  if (process.platform === 'darwin') {
    return `macOS ${systemVersion}`;
  }
  if (process.platform === 'linux') {
    return `Linux ${systemVersion}`;
  }
  return `${os.type()} ${systemVersion}`;
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
