/** Native operations used by the unmodified electron-mpv-video element. */
export interface SeekPlayer extends EventTarget {
  /** Accepts a seek command, but does not wait for decoded output. */
  seek(seconds: number): Promise<void>;
  /** Silences intermediate seek output. */
  pause(): Promise<void>;
  /** Restores the pre-seek playback intent after the final target settles. */
  play(): Promise<void>;
}

/** Waits for the native seek/restart pair, not merely the IPC acknowledgement. */
export async function seekMpvAndWait(
  player: SeekPlayer,
  seconds: number,
  signal: AbortSignal,
  timeoutMs = 8000,
): Promise<void> {
  let started = false;
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // An abort/native error may arrive while seek() itself is still awaiting IPC.
  void ready.catch(() => undefined);
  /** Completes only after this command's seek event and decoded restart. */
  const onEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ type: string; error?: string }>).detail;
    if (detail.type === 'seek') started = true;
    if (started && detail.type === 'playback-restart') resolveReady();
    if (detail.error || detail.type === 'end-file') rejectReady(new Error('Video seek could not complete.'));
  };
  /** Cancels listeners when another source or view supersedes this seek. */
  const onAbort = () => rejectReady(new Error('Video seek canceled.'));
  const timer = setTimeout(() => rejectReady(new Error('Video seek timed out.')), timeoutMs);
  player.addEventListener('mpv-event', onEvent);
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    if (signal.aborted) throw new Error('Video seek canceled.');
    await player.seek(seconds);
    await ready;
  } finally {
    clearTimeout(timer);
    player.removeEventListener('mpv-event', onEvent);
    signal.removeEventListener('abort', onAbort);
  }
}

/** One paused batch, retained between preview seeks until the pointer is released. */
interface SeekBatch {
  /** Revokes native completion observers on source/view changes. */
  readonly abort: AbortController;
  /** Captured player; never seek a replacement player with an old request. */
  readonly player: SeekPlayer;
  /** Playback intent before temporary pausing. */
  readonly resume: boolean;
  /** Only the latest unsent target is retained. */
  pending?: number;
  /** Last completed target, to avoid repeating the pointer-up preview. */
  last?: number;
  /** Whether the pause IPC has completed. */
  paused: boolean;
  /** A pointer release or ordinary seek ends the preview batch. */
  final: boolean;
  /** Prevents concurrent drain loops. */
  draining: boolean;
}

/** Latest-target-wins seeks with silent previews and one final playback restart. */
export class MpvSeekQueue {
  /** Captured batch, or undefined after cancellation/completion. */
  private batch?: SeekBatch;

  /** Uses live refs to prevent an outgoing source from resuming after navigation. */
  constructor(
    /** Current native element. */
    private readonly getPlayer: () => SeekPlayer | null,
    /** Playback intent before entering temporary seek pause. */
    private readonly isPlaying: () => boolean,
    /** View/source lifetime fence for playback restoration. */
    private readonly canResume: () => boolean,
    /** Reports actual native failure rather than silently restarting. */
    private readonly onError: (error: unknown) => void,
  ) {}

  /** Starts or replaces a seek; previews remain paused until final commit. */
  request(seconds: number, preview: boolean): void {
    const player = this.getPlayer();
    if (!player) return;
    if (this.batch && this.batch.player !== player) this.cancel();
    const batch = this.batch ??= {
      abort: new AbortController(), player, resume: this.isPlaying(),
      paused: false, final: false, draining: false,
    };
    batch.pending = seconds;
    batch.final = !preview;
    void this.drain(batch);
  }

  /** A canceled gesture releases its temporary pause without another seek. */
  finish(): void {
    if (!this.batch) return;
    this.batch.final = true;
    void this.drain(this.batch);
  }

  /** Never resumes a retired source or disposed player. */
  cancel(): void {
    const batch = this.batch;
    this.batch = undefined;
    batch?.abort.abort();
  }

  /** Waits for decoded frames and coalesces targets while a native seek is busy. */
  private async drain(batch: SeekBatch): Promise<void> {
    if (batch.draining) return;
    batch.draining = true;
    try {
      if (!batch.paused) {
        await batch.player.pause();
        if (this.batch !== batch) return;
        batch.paused = true;
      }
      while (batch.pending !== undefined && this.batch === batch) {
        const target = batch.pending;
        batch.pending = undefined;
        if (batch.last === undefined || Math.abs(batch.last - target) > 0.001) {
          await seekMpvAndWait(batch.player, target, batch.abort.signal);
          if (this.batch !== batch) return;
          batch.last = target;
        }
      }
      if (this.batch !== batch || !batch.final) return;
      if (batch.resume && this.canResume()) {
        batch.paused = false;
        await batch.player.play();
      }
      if (this.batch === batch && batch.pending === undefined) this.batch = undefined;
    } catch (error) {
      if (this.batch !== batch) return;
      this.cancel();
      this.onError(error);
    } finally {
      batch.draining = false;
      if (this.batch === batch && batch.pending !== undefined) void this.drain(batch);
    }
  }
}
