import {
  useCallback,
  useEffect
} from 'react';
import type {
  VideoMessages
} from '../../../../Common/IPC';
import { getMpvErrorMessage } from '../Presentation';
import { type useVideoState } from './useVideoState';

/** Inputs used by useVideoVolume. */
type VideoVolumeOptions = Pick<ReturnType<typeof useVideoState>,
  | 'volumePersistTimerRef'
  | 'pendingVolumePersistRef'
  | 'volumeRef'
  | 'setVolume'
  | 'fallbackVideoRef'
  | 'playerRef'
  | 'setError'
  | 'preferences'
> & {
  /** The labels value for this section. */
  readonly labels: VideoMessages;
};

/** Coordinates video volume behavior for this View. */
export function useVideoVolume({
  volumePersistTimerRef,
  pendingVolumePersistRef,
  volumeRef,
  setVolume,
  fallbackVideoRef,
  playerRef,
  setError,
  labels,
  preferences,
}: VideoVolumeOptions) {
  const flushVolumePersistence = useCallback(() => {
    if (volumePersistTimerRef.current !== undefined) {
      window.clearTimeout(volumePersistTimerRef.current);
      volumePersistTimerRef.current = undefined;
    }
    const pending = pendingVolumePersistRef.current;
    if (pending === undefined) return;
    void window.kawaikaraVideo.preferences
      .setVideoVolume(pending)
      .then((saved) => {
        if (pendingVolumePersistRef.current !== pending) return;
        pendingVolumePersistRef.current = undefined;
        if (saved === volumeRef.current) return;
        volumeRef.current = saved;
        setVolume(saved);
      })
      .catch((reason: unknown) => {
        console.warn('[video] The volume preference could not be saved.', reason);
      });
  }, []);

  const scheduleVolumePersistence = useCallback((next: number) => {
    pendingVolumePersistRef.current = next;
    if (volumePersistTimerRef.current !== undefined) {
      window.clearTimeout(volumePersistTimerRef.current);
    }
    volumePersistTimerRef.current = window.setTimeout(() => {
      volumePersistTimerRef.current = undefined;
      flushVolumePersistence();
    }, 240);
  }, [flushVolumePersistence]);

  const updateVolume = useCallback((next: number, persist = true) => {
    const normalized = Math.min(100, Math.max(0, next));
    volumeRef.current = normalized;
    setVolume(normalized);
    if (fallbackVideoRef.current) {
      fallbackVideoRef.current.volume = normalized / 100;
    }
    void playerRef.current?.setVolume(normalized).catch((reason: unknown) =>
      setError(getMpvErrorMessage(reason, labels)),
    );
    if (persist) scheduleVolumePersistence(normalized);
  }, [labels, scheduleVolumePersistence]);

  useEffect(() => {
    if (pendingVolumePersistRef.current !== undefined) return;
    updateVolume(preferences.videoVolume, false);
  }, [preferences.videoVolume, updateVolume]);

  useEffect(() => {
    /** Performs the flush pending volume operation. */
    const flushPendingVolume = () => flushVolumePersistence();
    window.addEventListener('pagehide', flushPendingVolume);
    return () => {
      window.removeEventListener('pagehide', flushPendingVolume);
      flushVolumePersistence();
    };
  }, [flushVolumePersistence]);

  return {
    /** The flushVolumePersistence value. */
    flushVolumePersistence,
    /** The updateVolume value. */
    updateVolume,
  };
}
