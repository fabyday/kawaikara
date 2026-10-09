/// <reference types="@webgpu/types" />
import {
    currentFrame,
    type EffectVideo,
    type EffectCanvas,
} from './Source.mts';
/** Private device per effect: device.destroy also releases upstream-owned textures. */
export async function gpu(
    video: EffectVideo,
    canvas: EffectCanvas,
    scale = 2,
    requiredLimits: GPUDeviceDescriptor['requiredLimits'] = {},
) {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter || adapter.info.isFallbackAdapter)
        throw new Error('Hardware GPU unavailable');
    const device = await adapter.requestDevice({ requiredLimits });
    try {
        const width = video.videoWidth,
            height = video.videoHeight;
        if (!width || !height || width * scale > 4096 || height * scale > 4096)
            throw new Error('Output size exceeds budget');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const context = canvas.getContext('webgpu') as GPUCanvasContext;
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'opaque' });
        let lost = false;
        device.lost.then(() => {
            lost = true;
        });
        device.addEventListener('uncapturederror', (event) => {
            event.preventDefault();
            lost = true;
        });
        const texture = (w: number, h: number) =>
            device.createTexture({
                size: [w, h],
                format: 'rgba16float',
                usage:
                    GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.STORAGE_BINDING |
                    GPUTextureUsage.RENDER_ATTACHMENT |
                    GPUTextureUsage.COPY_DST,
            });
        const input = texture(width, height);
        const shader = device.createShaderModule({
            code: `
      @group(0) @binding(0) var source: texture_2d<f32>;
      @group(0) @binding(1) var s: sampler;
      struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
      @vertex fn vertex(@builtin(vertex_index) i: u32) -> V {
        let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
        var v: V; v.pos = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0, 1); v.uv=uv; return v;
      }
      @fragment fn fragment(v: V) -> @location(0) vec4f { return vec4f(textureSample(source,s,v.uv).rgb,1); }
    `,
        });
        const pipeline = await device.createRenderPipelineAsync({
            layout: 'auto',
            vertex: { module: shader, entryPoint: 'vertex' },
            fragment: {
                module: shader,
                entryPoint: 'fragment',
                targets: [{ format }],
            },
        });
        const sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });
        return {
            device,
            input,
            texture,
            width,
            height,
            async render(
                output: GPUTexture,
                passes: (encoder: GPUCommandEncoder) => void,
            ) {
                if (lost) throw new Error('GPU device lost');
                device.pushErrorScope('validation');
                try {
                    device.queue.copyExternalImageToTexture(
                        { source: currentFrame(video) },
                        { texture: input },
                        [width, height],
                    );
                    const encoder = device.createCommandEncoder();
                    passes(encoder);
                    const pass = encoder.beginRenderPass({
                        colorAttachments: [
                            {
                                view: context.getCurrentTexture().createView(),
                                loadOp: 'clear',
                                storeOp: 'store',
                            },
                        ],
                    });
                    pass.setPipeline(pipeline);
                    pass.setBindGroup(
                        0,
                        device.createBindGroup({
                            layout: pipeline.getBindGroupLayout(0),
                            entries: [
                                { binding: 0, resource: output.createView() },
                                { binding: 1, resource: sampler },
                            ],
                        }),
                    );
                    pass.draw(3);
                    pass.end();
                    device.queue.submit([encoder.finish()]);
                    await device.queue.onSubmittedWorkDone();
                } finally {
                    const error = await device.popErrorScope();
                    if (error) throw new Error(error.message);
                }
            },
            dispose() {
                context.unconfigure();
                device.destroy();
            },
        };
    } catch (error) {
        device.destroy();
        throw error;
    }
}
