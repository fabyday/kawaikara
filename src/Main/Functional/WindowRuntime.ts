import type { UnifiedPictureInPictureManager } from '../Manager/UnifiedPictureInPictureManager';
import type { BrowserWindow } from 'electron';

/** Defines the picture in picture manager factory type. */
export type PictureInPictureManagerFactory = (
  ...args: ConstructorParameters<typeof UnifiedPictureInPictureManager>
) => UnifiedPictureInPictureManager;

/** Describes the internal video picture in picture state contract. */
export interface InternalVideoPictureInPictureState {
  /** Native PiP host for the retained Video renderer view. */
  readonly window: BrowserWindow;
}
