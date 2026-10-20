import type { WebContents } from 'electron';
import { formatConsoleSource } from './Logging';
import type { createScopedLogger } from './LogTransport';
import type { ApplicationLogSourceId } from './LogTypes';

/** Registers renderer console and responsiveness diagnostics without retaining a manager.
 * @param getLogger Factory that applies source and location policy.
 * @param webContents Renderer whose lifetime bounds these subscriptions.
 * @param source Registered application log source.
 * @param includeMessage Optional console filter, evaluated before a message is logged.
 * @param location Base call location; console filenames are appended.
 * @returns Idempotent disposer, also invoked on renderer destruction.
 */
export function connectRendererLogging(
    getLogger: typeof createScopedLogger,
    webContents: WebContents,
    source: ApplicationLogSourceId,
    includeMessage: (message: string) => boolean = () => true,
    location?: string,
): () => void {
    const rendererLog = getLogger(source, location);
    /** Handles the console message. */
    const handleConsoleMessage = (
        details: Electron.Event<Electron.WebContentsConsoleMessageEventParams>,
    ) => {
        if (!includeMessage(details.message)) return;
        const consoleSource = formatConsoleSource(
            details.sourceId,
            details.lineNumber,
        );
        const consoleLocation = consoleSource.split(/[\\/]/).at(-1);
        const targetLocation = [location, consoleLocation]
            .filter((value): value is string => Boolean(value))
            .join('/');
        const targetLog = targetLocation
            ? getLogger(source, targetLocation)
            : rendererLog;
        switch (details.level) {
            case 'error':
                targetLog.error(details.message);
                break;
            case 'warning':
                targetLog.warn(details.message);
                break;
            case 'debug':
                targetLog.debug(details.message);
                break;
            default:
                targetLog.info(details.message);
                break;
        }
    };
    /** Handles the unresponsive. */
    const handleUnresponsive = () =>
        rendererLog.warn('Renderer became unresponsive.');
    /** Handles the responsive. */
    const handleResponsive = () =>
        rendererLog.info('Renderer became responsive again.');
    /** Releases the operation. */
    const dispose = () => {
        webContents.off('console-message', handleConsoleMessage);
        webContents.off('unresponsive', handleUnresponsive);
        webContents.off('responsive', handleResponsive);
        webContents.off('destroyed', dispose);
    };

    webContents.on('console-message', handleConsoleMessage);
    webContents.on('unresponsive', handleUnresponsive);
    webContents.on('responsive', handleResponsive);
    webContents.once('destroyed', dispose);
    return dispose;
}
