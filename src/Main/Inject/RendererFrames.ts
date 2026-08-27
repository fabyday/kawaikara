import { serializePageInjection } from './Serialize';

/**
 * Page-world render-settle barrier used exclusively by
 * transferWebContentsView() in Main/Functional/WebContentsViewTransfer.ts.
 * That function executes the serialized export after moving a site view
 * between the viewer and PiP BrowserWindows.
 */
async function waitForTwoRendererFrames(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Defines the shared wait for visible renderer frames script constant. */
export const WAIT_FOR_VISIBLE_RENDERER_FRAMES_SCRIPT =
  serializePageInjection(waitForTwoRendererFrames);
