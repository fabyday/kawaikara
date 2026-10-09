import {
    BilateralMean,
    CNNM,
    CNNSoftM,
    CNNx2M,
    CNNx2UL,
    DoG,
    type Anime4KPipeline,
} from 'anime4k-webgpu';
import { gpu } from './Gpu.mts';
import type { EffectVideo, EffectCanvas } from './Source.mts';
/** Denoising and restoration run at source resolution before the 2x upscale. */
export async function create(
    video: EffectVideo,
    canvas: EffectCanvas,
    options: Readonly<Record<string, unknown>> = {},
) {
    // Upstream CNN initialization uploads expand with input area. At 1080p the
    // staging buffer is 506.25 MiB, beyond WebGPU's default 256 MiB device limit.
    // requestDevice validates the required budget against this hardware adapter.
    const balanced = options.quality === 'balanced';
    // M reduces convolution work, not the library's peak staging-upload size.
    const maxBufferSize = Math.max(
        256 * 1024 * 1024,
        video.videoWidth * video.videoHeight * 256,
    );
    const runtime = await gpu(video, canvas, 2, { maxBufferSize });
    try {
        const stages: Anime4KPipeline[] = [];
        let inputTexture = runtime.input;
        const add = (stage: Anime4KPipeline): void => {
            stages.push(stage);
            inputTexture = stage.getOutputTexture();
        };
        const denoise = ['off', 'light', 'medium'].includes(
            String(options.denoise),
        )
            ? options.denoise
            : 'light';
        const restore = ['off', 'soft', 'detail', 'strong'].includes(
            String(options.restore),
        )
            ? options.restore
            : 'soft';
        if (denoise !== 'off') {
            const node = new BilateralMean({
                device: runtime.device,
                inputTexture,
            });
            // Both uniforms must be positive. Zero sigma would divide by zero in the upstream shader.
            node.updateParam('strength', denoise === 'medium' ? 0.1 : 0.04);
            node.updateParam('strength2', 1.0);
            add(node);
        }
        if (restore !== 'off') {
            const Restore = restore === 'soft' ? CNNSoftM : CNNM;
            add(new Restore({ device: runtime.device, inputTexture }));
        }
        if (restore === 'strong') {
            const deblur = new DoG({ device: runtime.device, inputTexture });
            deblur.updateParam('strength', 2.0);
            add(deblur);
        }
        const Upscale = balanced ? CNNx2M : CNNx2UL;
        add(new Upscale({ device: runtime.device, inputTexture }));
        return {
            render: () =>
                runtime.render(inputTexture, (encoder) => {
                    for (const stage of stages) stage.pass(encoder);
                }),
            dispose: runtime.dispose,
        };
    } catch (error) {
        runtime.dispose();
        throw error;
    }
}
