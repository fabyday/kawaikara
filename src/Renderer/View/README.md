# Renderer View ownership

`App.tsx` composes the screen and coordinates page-level state. Main still loads
the existing Overlay, Video and ExternalLogin entry points; this structure does
not introduce new windows, IPC endpoints or playback instances.

- `Preference`: `Tabs` owns each settings page; `MenuOrder`, `Shortcuts` and
  `Bundles` own their editors. `Hooks` owns draft/save policy, initialization,
  confirmation actions and subscriptions. `Logic` contains pure transformations.
- `Video`: `Playback` owns backend source validation, seek ranges and shortcut
  interpretation. `Hooks` owns player lifecycle, source changes, media events,
  keyboard input, volume persistence and scrubbing. The native player host and
  fallback video remain mounted in `App.tsx`; presentation panels cannot create
  a player. `Browser` contains library-specific presentation and types.
- `Menu`: the rail and address section are local UI. `Hooks` owns overlay
  subscriptions, navigation and window actions; the motion shell stays in App.
- `LogViewer`: history and table are local UI. `Hooks` owns repository polling,
  filters, selection, file actions and column resizing.
- `Update`: status/actions, release-note presentation and progress formatting
  stay local to the update panel. App copy comes from Main-resolved catalogs.

Keep feature-specific UI inside its owning View even when it is composed of
several smaller components. Promote something to `Renderer/Component` only when
at least two Views use the same View-independent concept and API, not merely
because markup looks similar. A component used by several files in one View
still belongs to that View. Review this ownership when a second View starts or
stops using it; `Renderer/Component` is a shared layer, not a default destination.

Use ordinary React state for state owned by one component, short-lived form
input, DOM/media refs and lifecycle cleanup. A View-scoped external store such
as Zustand is appropriate when several distant sections read different slices
of one state machine, IPC events and commands must update that state outside a
render tree, or a large hook result causes unrelated sections to rerender. Create
one store instance per mounted View and subscribe through selectors; do not make
renderer-wide singleton stores or put DOM nodes, media objects, timers and
imperative cleanup handles into them. Hooks remain the boundary for effects and
can read or dispatch store state. Do not depend on the identity of an entire hook
or store result object in an effect; depend on the relevant values instead.

Pure transformations belong in local logic modules; subscriptions, timers and
cleanup belong together in lifecycle hooks. Preserve player refs, effect
dependencies and motion boundaries when moving code. File size is a review
signal, not a splitting target.

Regression checks: `pnpm typecheck`, `pnpm storybook:build`, and
`node node_modules/electron/cli.js tests/renderer-views.electron.cjs`.
Video/library coverage also lives in `locale-and-video-navigation.electron.cjs`
and `pip-visibility-and-site-transition.electron.cjs`.

Composite sections should name their meaningful parts as module-level functions
inside the same file (for example, LogGroupList → LogGroupItem → LogGroupIdentity).
Pass data and callbacks explicitly; do not define component types inside a render
function or add wrappers that change layout, refs, animation, or reconciliation.
A local component does not need its own file and is not automatically shared UI.

App-owned UI copy belongs in root locales/en.json, ko.json and ja.json. Main uses
Functional/Locale.ts to select the catalog; Renderer receives message props/IPC
and never imports these JSON files. Keep shortcut IDs and default keys separate
from translated names. External-site recognition text, protocol names, and raw
diagnostic details are not UI translation dictionaries.
