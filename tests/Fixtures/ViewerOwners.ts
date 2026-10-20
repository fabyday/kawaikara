// Compatibility fixture for existing behavior assertions which populate a flat
// state object without running Electron constructors. Production has no facade.
import { ProviderSiteHost } from '../../src/Main/Functional/Bundle/Provider/ProviderSiteHost';
import { VideoController } from '../../src/Main/Functional/Video/VideoController';
import { ViewerController } from '../../src/Main/Functional/Viewer/ViewerController';
import { ViewerDiagnostics } from '../../src/Main/Functional/Viewer/ViewerDiagnostics';
import { ViewerInput } from '../../src/Main/Functional/Viewer/ViewerInput';
import { ViewerLifecycle } from '../../src/Main/Functional/Viewer/ViewerLifecycle';
import { ViewerPictureInPicture } from '../../src/Main/Functional/Viewer/ViewerPictureInPicture';
import { WindowManager as NativeWindows } from '../../src/Main/Manager/WindowManager';

export class WindowManager {}
for (const owner of [
    NativeWindows,
    ProviderSiteHost,
    VideoController,
    ViewerController,
    ViewerDiagnostics,
    ViewerInput,
    ViewerLifecycle,
    ViewerPictureInPicture,
]) {
    for (const [name, descriptor] of Object.entries(
        Object.getOwnPropertyDescriptors(owner.prototype),
    )) {
        if (name === 'constructor' || typeof descriptor.value !== 'function')
            continue;
        const method = descriptor.value;
        Object.defineProperty(WindowManager.prototype, name, {
            configurable: true,
            writable: true,
            value: function (...args: unknown[]) {
                const receiver = new Proxy(this, {
                    get(target, key, receiver) {
                        if (key === 'host') return target;
                        return Reflect.get(target, key, receiver);
                    },
                });
                return method.apply(receiver, args);
            },
        });
    }
}

Object.defineProperty(WindowManager.prototype, 'presentationTransition', {
    configurable: true,
    writable: true,
    value: Promise.resolve(),
});
Object.defineProperty(
    WindowManager.prototype,
    'pendingPresentationTransitions',
    { configurable: true, writable: true, value: 0 },
);
