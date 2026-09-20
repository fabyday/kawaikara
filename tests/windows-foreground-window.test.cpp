// Exercise the real native detector with deterministic Win32 reads. No windows
// are created, focused or reordered; these tests cannot disturb a running game.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <dwmapi.h>
#include <cstdio>
#include <cstdlib>
#include <vector>

namespace fixture {
struct Display { RECT bounds; };
struct Window {
  Display* display;
  RECT bounds;
  DWORD process = 2;
  LONG_PTR style = WS_POPUP;
  bool visible = true;
  bool minimized = false;
  bool maximized = false;
  bool destroyed = false;
  Window* owner = nullptr;
  LONG_PTR exstyle = 0;
  bool cloaked = false;
  const wchar_t* class_name = L"FixtureWindow";
};
HWND foreground = nullptr;
std::vector<HWND> stacking;
HWND Handle(Window& window) { return reinterpret_cast<HWND>(&window); }
Window& Data(HWND window) { return *reinterpret_cast<Window*>(window); }
BOOL IsWindow(HWND window) { return window && !Data(window).destroyed; }
HWND Ancestor(HWND window, UINT flag) {
  if (!fixture::IsWindow(window)) return nullptr;
  if (flag == GA_ROOTOWNER && Data(window).owner) return Handle(*Data(window).owner);
  return window;
}
HWND Foreground() { return foreground; }
BOOL Visible(HWND window) { return Data(window).visible; }
BOOL Iconic(HWND window) { return Data(window).minimized; }
DWORD Process(HWND window, LPDWORD process) { *process = Data(window).process; return 1; }
DWORD CurrentProcess() { return 1; }
HWND NoShellWindow() { return nullptr; }
int ClassName(HWND window, LPWSTR result, int size) {
  wcsncpy_s(result, size, Data(window).class_name, _TRUNCATE);
  return static_cast<int>(wcslen(result));
}
HRESULT DwmAttribute(HWND window, DWORD, PVOID value, DWORD) {
  *static_cast<DWORD*>(value) = Data(window).cloaked ? 1 : 0;
  return S_OK;
}
BOOL Placement(HWND window, WINDOWPLACEMENT* placement) {
  placement->showCmd = Data(window).maximized ? SW_SHOWMAXIMIZED : SW_SHOWNORMAL;
  return TRUE;
}
LONG_PTR Style(HWND window, int index) { return index == GWL_EXSTYLE ? Data(window).exstyle : Data(window).style; }
BOOL Enumerate(WNDENUMPROC callback, LPARAM data) {
  for (HWND window : stacking) if (!callback(window, data)) return FALSE;
  return TRUE;
}
HWND Relative(HWND window, UINT direction) {
  for (size_t i = 0; i < stacking.size(); i++) {
    if (stacking[i] == window && direction == GW_HWNDPREV) return i ? stacking[i-1] : nullptr;
  }
  return nullptr;
}
BOOL Bounds(HWND window, LPRECT bounds) { *bounds = Data(window).bounds; return TRUE; }
HMONITOR Monitor(HWND window, DWORD) { return reinterpret_cast<HMONITOR>(Data(window).display); }
BOOL MonitorInfo(HMONITOR display, LPMONITORINFO info) {
  info->rcMonitor = reinterpret_cast<Display*>(display)->bounds;
  return TRUE;
}
}

#define GetAncestor fixture::Ancestor
#define GetForegroundWindow fixture::Foreground
#define IsWindow fixture::IsWindow
#define IsWindowVisible fixture::Visible
#define IsIconic fixture::Iconic
#define GetWindowThreadProcessId fixture::Process
#define GetCurrentProcessId fixture::CurrentProcess
#define GetDesktopWindow fixture::NoShellWindow
#define GetShellWindow fixture::NoShellWindow
#define GetClassNameW fixture::ClassName
#define GetWindowPlacement fixture::Placement
#define GetWindowLongPtrW fixture::Style
#define GetWindowRect fixture::Bounds
#define MonitorFromWindow fixture::Monitor
#define GetMonitorInfoW fixture::MonitorInfo
#define EnumWindows fixture::Enumerate
#define GetWindow fixture::Relative
#define DwmGetWindowAttribute fixture::DwmAttribute
#include "../native/win32/monitoring/WindowsForegroundWindow.cpp"

void Check(bool condition, const char* description) {
  if (condition) return;
  std::fprintf(stderr, "FAILED: %s\n", description);
  std::exit(1);
}

void ForegroundEvent(HWND window) {
  HandleWindowEvent(nullptr, EVENT_SYSTEM_FOREGROUND, window,
      OBJID_WINDOW, CHILDID_SELF, 0, 0);
}

int main() {
  fixture::Display left{{-2560, 0, 0, 1440}}, right{{0, 0, 1920, 1080}};
  fixture::Window app{&left, {-2200, 100, -1400, 700}, 1};
  fixture::Window game{&left, left.bounds};
  fixture::Window ordinary{&left, {-2400, 0, -800, 1000}};
  ordinary.style = WS_OVERLAPPEDWINDOW;
  fixture::stacking = {fixture::Handle(app), fixture::Handle(game), fixture::Handle(ordinary)};
  monitor.application_window = fixture::Handle(app);
  // Enable the native event filter, but never call into Node in this fixture.
  monitor.callback = reinterpret_cast<napi_ref>(1);
  fixture::foreground = fixture::Handle(app);

  ForegroundEvent(fixture::Handle(game));
  Check(monitor.blocking_window == fixture::Handle(game),
      "remember the event HWND even if foreground already returned to Kawaikara");
  Check(IsExternalFullscreenActive(fixture::Handle(app)),
      "first fullscreen activation must survive a quick Alt+Tab roundtrip");

  app.display = &right;
  Check(!IsExternalFullscreenActive(fixture::Handle(app)),
      "a game on the left must not suppress AOT on the right");
  ForegroundEvent(fixture::Handle(game));
  Check(!IsExternalFullscreenActive(fixture::Handle(app)),
      "late events from the old display must not suppress the new display");

  game.display = &right; game.bounds = right.bounds;
  ForegroundEvent(fixture::Handle(game));
  Check(IsExternalFullscreenActive(fixture::Handle(app)),
      "fullscreen on the right works identically to fullscreen on the left");
  app.display = &left;
  Check(!IsExternalFullscreenActive(fixture::Handle(app)),
      "a game on the right must not suppress AOT on the left");

  game.display = &left; game.bounds = left.bounds;
  fixture::foreground = fixture::Handle(game);
  Check(IsExternalFullscreenActive(fixture::Handle(app)), "current foreground is still detected");
  fixture::foreground = fixture::Handle(ordinary);
  ForegroundEvent(fixture::Handle(ordinary));
  Check(IsExternalFullscreenActive(fixture::Handle(app)),
      "focusing an ordinary app does not close visible fullscreen ownership");
  ordinary.display = &right;
  ForegroundEvent(fixture::Handle(ordinary));
  Check(IsExternalFullscreenActive(fixture::Handle(app)),
      "focusing a second display must not release the first display's fullscreen owner");
  app.display = &right;
  Check(!IsExternalFullscreenActive(fixture::Handle(app)), "moving the viewer to a free display enables AOT");
  app.display = &left;
  Check(IsExternalFullscreenActive(fixture::Handle(app)), "moving back finds fullscreen without refocusing the game");
  fixture::Window second_game{&left, left.bounds, 5};
  fixture::stacking.insert(fixture::stacking.begin(), fixture::Handle(second_game));
  Check(IsExternalFullscreenActive(fixture::Handle(app)) && monitor.blocking_window == fixture::Handle(second_game),
      "the uppermost fullscreen window wins, independent of game name or foreground");
  second_game.minimized = true;
  Check(IsExternalFullscreenActive(fixture::Handle(app)) && monitor.blocking_window == fixture::Handle(game),
      "minimizing the upper game reveals the fullscreen game below it");
  fixture::stacking.erase(fixture::stacking.begin());
  second_game.minimized = false;
  second_game.display = &right; second_game.bounds = right.bounds;
  fixture::stacking.insert(fixture::stacking.begin(), fixture::Handle(second_game));
  Check(IsExternalFullscreenActive(fixture::Handle(app)) && monitor.blocking_window == fixture::Handle(game),
      "the highest fullscreen window on another display does not displace this display's owner");
  app.display = &right;
  Check(IsExternalFullscreenActive(fixture::Handle(app)) && monitor.blocking_window == fixture::Handle(second_game),
      "moving between two occupied displays selects the corresponding owner");
  app.display = &left;
  fixture::stacking.erase(fixture::stacking.begin());
  fixture::Window transparent_overlay{&left, left.bounds, 7};
  fixture::stacking.insert(fixture::stacking.begin(), fixture::Handle(transparent_overlay));
  transparent_overlay.exstyle = WS_EX_NOACTIVATE;
  Check(IsExternalFullscreenActive(fixture::Handle(app)) && monitor.blocking_window == fixture::Handle(game),
      "non-activating fullscreen overlays cannot mask the real game");
  transparent_overlay.exstyle = WS_EX_TRANSPARENT;
  Check(IsExternalFullscreenActive(fixture::Handle(app)) && monitor.blocking_window == fixture::Handle(game),
      "click-through fullscreen overlays cannot mask the real game");
  transparent_overlay.exstyle = 0; transparent_overlay.cloaked = true;
  Check(IsExternalFullscreenActive(fixture::Handle(app)) && monitor.blocking_window == fixture::Handle(game),
      "windows cloaked on another virtual desktop do not own this display");
  fixture::stacking.erase(fixture::stacking.begin());

  fixture::foreground = fixture::Handle(app);
  game.visible = false;
  Check(!IsExternalFullscreenActive(fixture::Handle(app)), "hidden games release display ownership");
  game.visible = true; game.cloaked = true;
  Check(!IsExternalFullscreenActive(fixture::Handle(app)), "cloaked games release display ownership");
  game.cloaked = false;
  game.minimized = true;
  ForegroundEvent(fixture::Handle(game));
  Check(!IsExternalFullscreenActive(fixture::Handle(app)), "ignore stale minimized-game events");
  game.minimized = false; game.destroyed = true;
  ForegroundEvent(fixture::Handle(game));
  Check(!IsExternalFullscreenActive(fixture::Handle(app)), "ignore stale destroyed-game events");
  game.destroyed = false; game.maximized = true;
  ForegroundEvent(fixture::Handle(game));
  Check(!IsExternalFullscreenActive(fixture::Handle(app)), "ordinary maximized windows stay excluded");
  game.maximized = false; game.bounds.bottom -= 48;
  ForegroundEvent(fixture::Handle(game));
  Check(!IsExternalFullscreenActive(fixture::Handle(app)), "work-area sized windows are not fullscreen");
  game.bounds = left.bounds;
  game.bounds.right -= 2;
  ForegroundEvent(fixture::Handle(game));
  Check(IsExternalFullscreenActive(fixture::Handle(app)), "tiny DPI seams remain accepted");

  // Reentrant dispatch may be coalesced, but the detector must retain its event.
  monitor.blocking_window = nullptr;
  monitor.dispatching = true;
  ForegroundEvent(fixture::Handle(game));
  monitor.dispatching = false;
  Check(IsExternalFullscreenActive(fixture::Handle(app)), "a nested event still updates the observation");

  fixture::Window overlay{&left, app.bounds, 1}; overlay.owner = &app;
  fixture::Window other_app_window{&right, right.bounds, 1};
  fixture::Window neutral{&left, ordinary.bounds, 3};
  fixture::Window anchor{&left, ordinary.bounds, 4};
  const HWND viewer = fixture::Handle(app), game_window = fixture::Handle(game);
  const HWND below = fixture::Handle(anchor), menu = fixture::Handle(overlay);
  const HWND preceding = fixture::Handle(neutral);
  fixture::foreground = game_window;
  fixture::stacking = {menu, viewer, game_window, preceding, below};
  Check(GetExternalFullscreenYieldTarget(viewer) == below,
      "clearing topmost is not enough: detect a normal viewer above the game");
  fixture::stacking = {menu, game_window, viewer, preceding, below};
  Check(GetExternalFullscreenYieldTarget(viewer) == below,
      "an owned menu still above the game also needs the viewer group to yield");
  fixture::stacking = {game_window, menu, viewer, preceding, below};
  Check(!GetExternalFullscreenYieldTarget(viewer), "already-yielded windows need no restacking");
  fixture::stacking = {fixture::Handle(other_app_window), game_window, viewer, preceding, below};
  Check(!GetExternalFullscreenYieldTarget(viewer), "unrelated application windows on other displays are ignored");
  fixture::stacking = {menu, viewer, game_window, preceding, below};
  app.display = &right;
  Check(!GetExternalFullscreenYieldTarget(viewer), "never lower an app on another monitor");
  app.display = &left;
  fixture::foreground = viewer;
  Check(!GetExternalFullscreenYieldTarget(viewer), "manual app activation must remain possible");
  fixture::foreground = menu;
  Check(!GetExternalFullscreenYieldTarget(viewer), "explicit menu activation is also accessible");
  fixture::foreground = fixture::Handle(ordinary);
  Check(!GetExternalFullscreenYieldTarget(viewer), "other-display focus preserves a prior explicit viewer activation");
  fixture::foreground = game_window;
  Check(GetExternalFullscreenYieldTarget(viewer) == below, "returning focus to the fullscreen game revokes the explicit raise");
  fixture::foreground = fixture::Handle(ordinary);
  Check(GetExternalFullscreenYieldTarget(viewer) == below, "other-display focus cannot restore a viewer that already yielded");
  fixture::foreground = viewer;
  Check(!GetExternalFullscreenYieldTarget(viewer), "the viewer can be explicitly raised again");
  fixture::foreground = fixture::Handle(ordinary);
  ForegroundEvent(game_window);
  Check(GetExternalFullscreenYieldTarget(viewer) == below, "a brief game activation revokes the exception even if foreground already moved to another display");
  fixture::foreground = game_window;
  game.minimized = true;
  Check(!GetExternalFullscreenYieldTarget(viewer), "ignore games minimized before the restack query");
  game.minimized = false;
  neutral.class_name = L"Shell_TrayWnd";
  Check(!GetExternalFullscreenYieldTarget(viewer), "never use the taskbar as an anchor or insert-after window");
  neutral.class_name = L"FixtureWindow";
  anchor.class_name = L"Shell_SecondaryTrayWnd";
  Check(!GetExternalFullscreenYieldTarget(viewer), "never target a secondary taskbar for restacking");
  anchor.class_name = L"FixtureWindow";
  fixture::stacking = {viewer, game_window, below};
  Check(!GetExternalFullscreenYieldTarget(viewer), "never use the protected game as Electron's insert-after HWND");
  fixture::stacking = {viewer, game_window};
  Check(!GetExternalFullscreenYieldTarget(viewer), "no anchor means no speculative window movement");
  StopExternalFullscreenMonitor(false);
  Check(!monitor.blocking_window && !monitor.explicitly_activated_over && !monitor.callback,
      "stop clears display ownership, explicit activation and subscription");
  std::puts("All native fullscreen fixtures passed");
  return 0;
}
