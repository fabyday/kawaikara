import { IPC_CHANNELS } from '../../../Common/IPC';
import type { PreferenceManager } from '../../Manager/PreferenceManager';
import type { ProviderManager } from '../../Manager/ProviderManager';
import type { VideoLibraryManager } from '../../Manager/VideoLibraryManager';
import { type ViewerRuntime } from '../Viewer/ViewerRuntime';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';
import { requirePathString, requireSearchQuery } from './Validation';

/** Dependencies used by video IPC only. */
interface VideoIpcDependencies {
    /** Application-scoped viewerRuntime dependency. */
    readonly viewerRuntime: Pick<ViewerRuntime, 'video' | 'viewer'>;
    /** Application-scoped sites dependency. */
    readonly sites: ProviderManager;
    /** Application-scoped videoLibrary dependency. */
    readonly videoLibrary: VideoLibraryManager;
    /** Application-scoped preferences dependency. */
    readonly preferences: PreferenceManager;
}

/** Connects video requests and events to their application services. */
export function connectVideoIpc({
    viewerRuntime,
    sites,
    videoLibrary,
    preferences,
}: VideoIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        /** Reuses the retained Video surface when already active. */
        const presentQueuedVideo = async (
            providerId = 'kawaikara.video',
        ): Promise<void> => {
            viewerRuntime.viewer.hideOverlay();
            if (
                sites.isCurrentSite(providerId) &&
                viewerRuntime.video.presentQueuedVideoOpenRequest()
            )
                return;
            await sites.load(providerId);
        };
        ipc.handle(IPC_CHANNELS.dragDrop.openFiles, (_event, paths: unknown) =>
            sites.dragDrop.openFiles(
                paths,
                () => sites.getActiveProviderId(),
                async (registration, files) => {
                    // Only the app-owned Video action is implemented in this phase.
                    if (registration.descriptor.action !== 'open-local-video')
                        return false;
                    if (
                        !(await viewerRuntime.video.queueDroppedVideoFiles(
                            files,
                        ))
                    )
                        return false;
                    await presentQueuedVideo(registration.providerId);
                    const request =
                        viewerRuntime.video.getCurrentVideoOpenRequest();
                    if (request?.kind === 'local') {
                        await videoLibrary.recordVideo(request);
                    }
                    return true;
                },
            ),
        );
        ipc.handle(IPC_CHANNELS.video.selectLocalFile, async () => {
            const request = await viewerRuntime.video.selectLocalVideo();
            if (request?.kind === 'local')
                await videoLibrary.recordVideo(request);
            return request;
        });
        ipc.handle(IPC_CHANNELS.video.getPlaybackCapabilities, () =>
            viewerRuntime.video.getVideoPlaybackCapabilities(),
        );
        ipc.handle(IPC_CHANNELS.video.getOpenRequest, () =>
            viewerRuntime.video.getCurrentVideoOpenRequest(),
        );
        ipc.handle(IPC_CHANNELS.video.recoverPlaybackRenderer, (event) =>
            viewerRuntime.video.recoverVideoPlaybackRenderer(event.sender.id),
        );
        ipc.handle(
            IPC_CHANNELS.video.activateLocalFile,
            async (event, value: unknown) => {
                const result = await videoLibrary.openPath(
                    requirePathString(value),
                );
                if (result.kind !== 'video') {
                    throw new TypeError('A local video file is required.');
                }
                if (
                    !viewerRuntime.video.activateVideoOpenRequest(
                        event.sender.id,
                        result.request,
                    )
                ) {
                    throw new Error('The Video view is no longer active.');
                }
                return result.request;
            },
        );
        ipc.on(
            IPC_CHANNELS.video.presentationChanged,
            (event, state: unknown) => {
                viewerRuntime.video.setInternalVideoPresentation(
                    event.sender.id,
                    state,
                );
            },
        );
        ipc.on(IPC_CHANNELS.video.playbackRendererReady, (event) => {
            viewerRuntime.video.notifyVideoPlaybackRendererReady(
                event.sender.id,
            );
        });
        ipc.handle(IPC_CHANNELS.video.librarySnapshot, () =>
            videoLibrary.getSnapshot(),
        );
        ipc.handle(IPC_CHANNELS.video.listDirectory, (_event, value: unknown) =>
            videoLibrary.listDirectory(requirePathString(value)),
        );
        ipc.handle(IPC_CHANNELS.video.openPath, (_event, value: unknown) =>
            videoLibrary.openPath(requirePathString(value)),
        );
        ipc.handle(
            IPC_CHANNELS.video.searchDirectory,
            (_event, directory: unknown, query: unknown) =>
                videoLibrary.searchDirectory(
                    requirePathString(directory),
                    requireSearchQuery(query),
                ),
        );
        ipc.handle(
            IPC_CHANNELS.video.pinFolder,
            (_event, value: unknown, pinned: unknown) => {
                if (typeof pinned !== 'boolean') {
                    throw new TypeError('Pinned state must be a boolean.');
                }
                return videoLibrary.setFolderPinned(
                    requirePathString(value),
                    pinned,
                );
            },
        );
        ipc.handle(IPC_CHANNELS.video.removeFolder, (_event, value: unknown) =>
            videoLibrary.removeFolder(requirePathString(value)),
        );
        ipc.handle(
            IPC_CHANNELS.video.openLibraryItem,
            async (_event, value: unknown) => {
                const result = await videoLibrary.openPath(
                    requirePathString(value),
                );
                viewerRuntime.video.queueVideoOpenRequest(
                    result.kind === 'directory'
                        ? videoLibrary.createFolderRequest(
                              result.listing.directory,
                          )
                        : result.request,
                );
                await presentQueuedVideo();
            },
        );
        ipc.handle(IPC_CHANNELS.video.thumbnail, (_event, value: unknown) =>
            videoLibrary.getThumbnail(requirePathString(value)),
        );
        ipc.handle(
            IPC_CHANNELS.video.setVolumePreference,
            async (_event, value: unknown) => {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    throw new TypeError(
                        'Video volume must be a finite number.',
                    );
                }
                const next = await preferences.update({
                    videoVolume: value,
                });
                return next.videoVolume;
            },
        );
    });
}
