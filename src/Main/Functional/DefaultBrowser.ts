import { shell } from 'electron';

/**
 * Open a web URL with the operating system's registered default browser.
 * Keeping this in Main also prevents remote page content from invoking
 * arbitrary external protocols through Electron's shell API.
 */
export async function openInDefaultBrowser(value: string): Promise<void> {
  const target = new URL(value);
  if (
    (target.protocol !== 'https:' && target.protocol !== 'http:') ||
    target.username ||
    target.password
  ) {
    throw new Error('Only credential-free HTTP(S) URLs can open externally.');
  }
  await shell.openExternal(target.href, {
    ...(process.platform === 'darwin' ? { activate: true } : {}),
    ...(process.platform === 'win32' ? { logUsage: true } : {}),
  });
}
