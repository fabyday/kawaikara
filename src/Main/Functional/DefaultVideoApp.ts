import { app, shell } from 'electron';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { UPDATE_TEST_PROFILE } from '../../Common/BuildConfig';

/** Reads registration scope without changing any Windows association. */
const queryRegistry = promisify(execFile);

/** Source runs and isolated updater fixtures must never claim installed application defaults. */
export function canConfigureDefaultVideoApp(): boolean {
  return process.platform === 'win32' && app.isPackaged && !UPDATE_TEST_PROFILE;
}

/** Opens the OS-owned consent UI for this channel, not whichever channel owns the URL protocol. */
export async function openDefaultVideoAppSettings(): Promise<void> {
  if (!canConfigureDefaultVideoApp()) throw new Error('An installed Windows build is required.');
  let destination = 'ms-settings:defaultapps';
  const name = app.getName();
  for (const hive of ['HKCU', 'HKLM'] as const) {
    try {
      await queryRegistry(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe'),
        ['query', `${hive}\\Software\\RegisteredApplications`, '/v', name],
        { windowsHide: true, timeout: 3000, maxBuffer: 8192 });
      destination += `?${hive === 'HKCU' ? 'registeredAppUser' : 'registeredAppMachine'}=${encodeURIComponent(name)}`;
      break;
    } catch { /* Older installs may not be registered; the general settings page remains usable. */ }
  }
  await shell.openExternal(destination);
}
