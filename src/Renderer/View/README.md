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
Keep the concise `Component` directory name: its location below `Renderer`
already communicates that it is the renderer's common component layer, so a
`CommonComponent` alias would repeat the same meaning. The current shared set is
`AutoHideScrollArea`, `RightArrowIcon`, `SiteIcon`, and `VideoThumbnail`.

Use ordinary React state for state owned by one component, short-lived form
input, DOM/media refs and lifecycle cleanup. A renderer-entry Zustand singleton
is appropriate for genuinely global UI state shared by multiple sibling Views,
such as the active overlay route, resolved locale/theme, selected site, or
update-panel status. It is global only inside that renderer process; state that
must cross Electron windows remains owned by Main and synchronized through IPC.

Use a View-scoped Zustand store when a complex View may have independent mounted
instances, needs Storybook/test isolation, or several distant sections consume
different slices of its state machine. Create the vanilla store once in a View
provider, put only that store instance in context, and call `useStore(store,
selector)` from consumers. Prefer narrow selectors and stable actions rather
than subscribing to the complete state object. Do not introduce a scoped store
for a small View merely because the library supports it, and do not put DOM
nodes, media objects, timers, or imperative cleanup handles in either kind of
store. Hooks remain the limited boundary for subscriptions, timers, IPC and
other effects; they may read or dispatch store state without becoming a second
state container. Effects depend on the exact selected values, never an entire
hook or store result object.

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
