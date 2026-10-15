import { shell } from 'electron';
/** Launch a validated URL using the native default-browser policy. */
export async function openInDefaultBrowser(url: string): Promise<void> {
    await shell.openExternal(url, { activate: true });
}
