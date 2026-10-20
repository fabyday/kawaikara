import { WebContentsView, type Input, type WebContents } from 'electron';
import { IPC_CHANNELS, type OverlayView } from '../../../Common/IPC';
import {
    bindWindowInput,
    type WindowInputAction,
    type WindowInputSurface,
} from '../Window/WindowInput';
import type { InternalVideoPictureInPictureState } from '../Window/WindowRuntime';
import type { LoggingManager } from '../../Manager/LoggingManager';
/** Capabilities used by ViewerInput; values are resolved from their owner at dispatch time. */
export interface ViewerInputHost {
    /** Reads siteView from its owner. */
    readonly siteView: WebContentsView | undefined;
    /** Reads videoView from its owner. */
    readonly videoView: WebContentsView | undefined;
    /** Reads overlaySurface from its owner. */
    readonly overlaySurface: WebContentsView | undefined;
    /** Requests toggleOverlay from its owner. */
    readonly toggleOverlay: () => void;
    /** Requests areViewerRequestsAccepted from its owner. */
    readonly areViewerRequestsAccepted: () => boolean;
    /** Reads overlayVisible from its owner. */
    readonly overlayVisible: boolean;
    /** Reads overlayView from its owner. */
    readonly overlayView: OverlayView;
    /** Reads closeMenuOnEscape from its owner. */
    readonly closeMenuOnEscape: boolean;
    /** Reads internalVideoVisible from its owner. */
    readonly internalVideoVisible: boolean;
    /** Reads internalVideoPictureInPicture from its owner. */
    readonly internalVideoPictureInPicture:
        InternalVideoPictureInPictureState | undefined;
}

/** Owns input state and lifecycle independently of application composition. */
export class ViewerInput {
    /** Feature logger. */
    private readonly logger;
    /** Connects only the capabilities used by this owner. */
    constructor(
        /** Cross-feature capabilities. */ private readonly host: ViewerInputHost,
        /** Renderer logging service. */ private readonly logging: LoggingManager,
    ) {
        this.logger = logging.getLogger('windowManager');
    }

    /** The editing web contents IDs value. */
    readonly editingWebContentsIds = new Set<number>();

    /** Callback used to handle shortcut handler. */
    shortcutHandler?: (input: Input, editing: boolean) => boolean;

    /** Sets the shortcut handler. */
    setShortcutHandler(
        handler: (input: Input, editing: boolean) => boolean,
    ): void {
        this.shortcutHandler = handler;
    }

    /** Sets the editing state. */
    setEditingState(webContentsId: number, editing: boolean): boolean {
        const viewerId = this.host.siteView?.webContents.id;
        const internalViewerId = this.host.videoView?.webContents.id;
        const overlayId = this.host.overlaySurface?.webContents.id;
        if (
            webContentsId !== viewerId &&
            webContentsId !== internalViewerId &&
            webContentsId !== overlayId
        ) {
            return false;
        }
        if (editing) {
            this.editingWebContentsIds.add(webContentsId);
        } else {
            this.editingWebContentsIds.delete(webContentsId);
        }
        return true;
    }

    /** Applies semantic actions after the input adapter has resolved key policy. */
    dispatchWindowInput(
        surface: WindowInputSurface,
        action: WindowInputAction,
    ): void {
        if (surface === 'overlay') {
            const contents = this.host.overlaySurface?.webContents;
            if (contents && !contents.isDestroyed()) {
                if (action === 'toggle-menu')
                    contents.send(IPC_CHANNELS.overlay.requestClose, 'toggle');
                else if (action === 'back')
                    contents.send(IPC_CHANNELS.overlay.requestClose);
            }
            return;
        }
        if (action === 'toggle-menu') this.host.toggleOverlay();
        else if (action === 'toggle-playback') {
            const contents = this.host.videoView?.webContents;
            if (contents && !contents.isDestroyed())
                contents.send(IPC_CHANNELS.video.playbackToggleRequested);
        }
    }

    /** Connects a surface to live state without embedding key interpretation here. */
    connectWindowInput(
        contents: WebContents,
        surface: WindowInputSurface,
    ): () => void {
        return bindWindowInput(contents, {
            /** Reads the current surface and editing state for each input event. */
            getState: () => ({
                surface,
                active:
                    this.host.areViewerRequestsAccepted() &&
                    (surface !== 'site' ||
                        this.host.siteView?.webContents === contents),
                editing:
                    surface === 'devtools' ||
                    this.editingWebContentsIds.has(contents.id),
                overlay: this.host.overlayVisible
                    ? this.host.overlayView
                    : undefined,
                closeMenuOnEscape: this.host.closeMenuOnEscape,
                videoVisible: this.host.internalVideoVisible,
                videoPictureInPicture: Boolean(
                    this.host.internalVideoPictureInPicture,
                ),
            }),
            /** Routes a semantic action to its presentation owner. */
            dispatch: (action) => this.dispatchWindowInput(surface, action),
            /** Defers configurable shortcuts to the application shortcut resolver. */
            shortcut: (input, editing) =>
                this.shortcutHandler?.(input, editing) ?? false,
        });
    }
}
