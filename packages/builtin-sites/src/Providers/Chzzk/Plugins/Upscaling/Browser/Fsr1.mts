import { EASU_SHADER } from 'fsr-easu';
import { RCAS_LEGACY_SHADER } from 'fsr-rcas';
import { gpu } from './Gpu.mts';
import type { EffectVideo, EffectCanvas } from './Source.mts';
/** FSR 1 spatial EASU -> RCAS graph; no motion-vector approximation. */
export async function create(video: EffectVideo, canvas: EffectCanvas, options: Readonly<Record<string, unknown>> = {}) {
  const runtime = await gpu(video, canvas);
  const { device, width, height, input, texture } = runtime;
  try {
    const intermediate = texture(width * 2, height * 2), output = texture(width * 2, height * 2);
    const constants = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const data = new Float32Array(24);
    data.set([width, height, width * 2, height * 2, 1/width, 1/height, 1/(width*2), 1/(height*2)]);
    data[16] = options.sharpness === 'strong' ? 1 : options.sharpness === 'soft' ? 0.25 : 0.5; data[18] = 1;
    device.queue.writeBuffer(constants, 0, data);
    const make = async (code: string, resources: [number, GPUBindingResource][]) => {
      const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: device.createShaderModule({ code }), entryPoint: 'main' } });
      device.pushErrorScope('validation');
      const bindings = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: constants } }, ...resources.map(([binding, resource]) => ({ binding, resource })),
      ] });
      const error = await device.popErrorScope(); if (error) throw new Error(error.message);
      return (encoder: GPUCommandEncoder) => {
        const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, bindings);
        pass.dispatchWorkgroups(Math.ceil(width * 2 / 8), Math.ceil(height * 2 / 8)); pass.end();
      };
    };
    const easu = await make(EASU_SHADER, [[1,input.createView()], [2,intermediate.createView()]]);
    const rcas = await make(RCAS_LEGACY_SHADER, [[1,intermediate.createView()], [2,intermediate.createView()], [3,output.createView()], [4,intermediate.createView()]]);
    return { render: () => runtime.render(output, encoder => { easu(encoder); rcas(encoder); }), dispose: runtime.dispose };
  } catch (error) { runtime.dispose(); throw error; }
}
