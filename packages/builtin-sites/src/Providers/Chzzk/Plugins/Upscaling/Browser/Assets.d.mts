/** Build-time aliases; no runtime URL or network fetching is exposed to Plugins. */
declare module 'websr-weights' {
  const weights: Readonly<Record<string, unknown>>;
  export default weights;
}
declare module 'realesrgan-model' {
  const model: Uint8Array;
  export default model;
}
declare module 'ort-wasm' {
  const wasm: Uint8Array;
  export default wasm;
}
declare module 'ort-bundled' { export * from 'onnxruntime-web'; }
declare module 'fsr-easu' { export const EASU_SHADER: string; }
declare module 'fsr-rcas' { export const RCAS_LEGACY_SHADER: string; }
