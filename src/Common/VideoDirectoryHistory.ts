/** A local-library navigation command, unrelated to web-document history. */
export type DirectoryNavigationDirection = 'back' | 'forward';

/** A destination; undefined represents the library's Computer page. */
export interface DirectoryHistoryTarget {
  /** The canonical directory, or Computer when absent. */
  readonly directory: string | undefined;
}

/** Keeps successful folder visits and advances only after a destination loads. */
export class VideoDirectoryHistory {
  /** Visited locations, including the initial Computer page. */
  private entries: (string | undefined)[] = [undefined];
  /** The current successful visit. */
  private index = 0;

  /** Starts a browser session at its restored initial location. */
  reset(directory: string | undefined): void {
    this.entries = [directory];
    this.index = 0;
  }

  /** Looks up a bounded history destination without changing the cursor. */
  target(offset: -1 | 1): DirectoryHistoryTarget | undefined {
    const index = this.index + offset;
    if (index < 0 || index >= this.entries.length) return undefined;
    return {
      /** The destination's stored directory, including the Computer sentinel. */
      directory: this.entries[index],
    };
  }

  /** Commits a successful visit; new navigation discards the forward branch. */
  commit(directory: string | undefined, offset?: -1 | 1): void {
    if (offset !== undefined) {
      if (!this.target(offset)) return;
      this.index += offset;
      this.entries[this.index] = directory;
      return;
    }
    if (this.entries[this.index] === directory) return;
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(directory);
    this.index += 1;
  }
}
