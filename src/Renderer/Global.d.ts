import type {
  KawaikaraRendererApi,
  KawaikaraVideoApi,
} from '../Common/IPC';

declare global {
  interface Window {
    kawaikara: KawaikaraRendererApi;
    kawaikaraVideo: KawaikaraVideoApi;
  }
}

export {};
