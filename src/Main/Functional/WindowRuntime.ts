import type { UnifiedPictureInPictureManager } from '../Manager/UnifiedPictureInPictureManager';

/** Defines the picture in picture manager factory type. */
export type PictureInPictureManagerFactory = (
  ...args: ConstructorParameters<typeof UnifiedPictureInPictureManager>
) => UnifiedPictureInPictureManager;

/** Describes the internal video picture in picture state contract. */
export interface InternalVideoPictureInPictureState {
  /** The minimum size value. */
  readonly minimumSize: readonly [number, number];
  /** Whether the movable option is enabled. */
  readonly movable: boolean;
  /** Whether the resizable option is enabled. */
  readonly resizable: boolean;
  /** Whether the visible on all workspaces option is enabled. */
  readonly visibleOnAllWorkspaces: boolean;
}
