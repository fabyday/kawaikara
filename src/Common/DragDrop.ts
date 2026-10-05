/** Safe routing summary returned to the app-owned drop UI, without file paths. */
export type FileDropResult =
  | {
      /** Result of the completed or rejected handoff. */
      readonly status: 'opened' | 'unsupported' | 'busy';
    }
  | {
      /** No Provider has run; a future chooser must obtain explicit consent. */
      readonly status: 'selection-required';
      /** Eligible owners, never automatically ordered as a priority list. */
      readonly providers: readonly {
        /** Stable Provider owner ID. */
        readonly id: string;
        /** Display name for a future chooser. */
        readonly title: string;
      }[];
    };
