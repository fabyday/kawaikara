import { serializePageInjection } from './Serialize';

async function waitForTwoRendererFrames(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export const WAIT_FOR_VISIBLE_RENDERER_FRAMES_SCRIPT =
  serializePageInjection(waitForTwoRendererFrames);
