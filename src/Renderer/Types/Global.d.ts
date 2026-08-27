import type {
  KawaikaraRendererApi,
  KawaikaraVideoApi,
} from '../../Common/IPC';

/** Groups the global declarations. */
declare global {
  /** Describes the window contract. */
  interface Window {
    /** The Kawaikara value. */
    kawaikara: KawaikaraRendererApi;
    /** The Kawaikara video value. */
    kawaikaraVideo: KawaikaraVideoApi;
  }
}

export {};
