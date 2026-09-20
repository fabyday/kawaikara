#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <dwmapi.h>
#pragma comment(lib, "dwmapi.lib")
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <cstdio>

// This add-on declares only the Node-API surface it needs and resolves those
// ABI-stable exports from Electron at runtime. It therefore needs neither
// Electron headers nor a version-specific node.lib.
extern "C" {
struct napi_env__;
struct napi_value__;
struct napi_callback_info__;
struct napi_ref__;
struct napi_handle_scope__;
using napi_env = napi_env__*;
using napi_value = napi_value__*;
using napi_callback_info = napi_callback_info__*;
using napi_ref = napi_ref__*;
using napi_handle_scope = napi_handle_scope__*;
using napi_status = int;
using napi_callback = napi_value (*)(napi_env, napi_callback_info);
using napi_cleanup_hook = void (*)(void*);
}

namespace {

constexpr napi_status napi_ok = 0;
constexpr int napi_function = 7;
constexpr size_t NAPI_AUTO_LENGTH = static_cast<size_t>(-1);
constexpr LONG MINIMUM_FULLSCREEN_EDGE_TOLERANCE = 12;

using NapiGetCallbackInfo = napi_status (*)(
    napi_env,
    napi_callback_info,
    size_t*,
    napi_value*,
    napi_value*,
    void**);
using NapiIsBuffer = napi_status (*)(napi_env, napi_value, bool*);
using NapiGetBufferInfo = napi_status (*)(
    napi_env,
    napi_value,
    void**,
    size_t*);
using NapiGetBoolean = napi_status (*)(napi_env, bool, napi_value*);
using NapiTypeof = napi_status (*)(napi_env, napi_value, int*);
using NapiGetUndefined = napi_status (*)(napi_env, napi_value*);
using NapiCreateStringUtf8 = napi_status (*)(napi_env, const char*, size_t, napi_value*);
using NapiCallFunction = napi_status (*)(
    napi_env,
    napi_value,
    napi_value,
    size_t,
    const napi_value*,
    napi_value*);
using NapiCreateReference = napi_status (*)(
    napi_env,
    napi_value,
    uint32_t,
    napi_ref*);
using NapiGetReferenceValue = napi_status (*)(
    napi_env,
    napi_ref,
    napi_value*);
using NapiDeleteReference = napi_status (*)(napi_env, napi_ref);
using NapiAddEnvCleanupHook = napi_status (*)(
    napi_env,
    napi_cleanup_hook,
    void*);
using NapiOpenHandleScope = napi_status (*)(napi_env, napi_handle_scope*);
using NapiCloseHandleScope = napi_status (*)(napi_env, napi_handle_scope);
using NapiCreateFunction = napi_status (*)(
    napi_env,
    const char*,
    size_t,
    napi_callback,
    void*,
    napi_value*);
using NapiSetNamedProperty = napi_status (*)(
    napi_env,
    napi_value,
    const char*,
    napi_value);
using NapiThrowError = napi_status (*)(
    napi_env,
    const char*,
    const char*);
using NapiThrowTypeError = napi_status (*)(
    napi_env,
    const char*,
    const char*);

struct NapiFunctions {
  NapiGetCallbackInfo get_callback_info = nullptr;
  NapiIsBuffer is_buffer = nullptr;
  NapiGetBufferInfo get_buffer_info = nullptr;
  NapiGetBoolean get_boolean = nullptr;
  NapiTypeof type_of = nullptr;
  NapiGetUndefined get_undefined = nullptr;
  NapiCreateStringUtf8 create_string_utf8 = nullptr;
  NapiCallFunction call_function = nullptr;
  NapiCreateReference create_reference = nullptr;
  NapiGetReferenceValue get_reference_value = nullptr;
  NapiDeleteReference delete_reference = nullptr;
  NapiAddEnvCleanupHook add_env_cleanup_hook = nullptr;
  NapiOpenHandleScope open_handle_scope = nullptr;
  NapiCloseHandleScope close_handle_scope = nullptr;
  NapiCreateFunction create_function = nullptr;
  NapiSetNamedProperty set_named_property = nullptr;
  NapiThrowError throw_error = nullptr;
  NapiThrowTypeError throw_type_error = nullptr;
};

NapiFunctions napi;

template <typename Function>
Function ResolveNodeApi(const char* name) {
  return reinterpret_cast<Function>(
      GetProcAddress(GetModuleHandleW(nullptr), name));
}

bool LoadNodeApi() {
  napi.get_callback_info = ResolveNodeApi<NapiGetCallbackInfo>(
      "napi_get_cb_info");
  napi.is_buffer = ResolveNodeApi<NapiIsBuffer>("napi_is_buffer");
  napi.get_buffer_info = ResolveNodeApi<NapiGetBufferInfo>(
      "napi_get_buffer_info");
  napi.get_boolean = ResolveNodeApi<NapiGetBoolean>("napi_get_boolean");
  napi.type_of = ResolveNodeApi<NapiTypeof>("napi_typeof");
  napi.get_undefined = ResolveNodeApi<NapiGetUndefined>("napi_get_undefined");
  napi.create_string_utf8 = ResolveNodeApi<NapiCreateStringUtf8>("napi_create_string_utf8");
  napi.call_function = ResolveNodeApi<NapiCallFunction>("napi_call_function");
  napi.create_reference = ResolveNodeApi<NapiCreateReference>(
      "napi_create_reference");
  napi.get_reference_value = ResolveNodeApi<NapiGetReferenceValue>(
      "napi_get_reference_value");
  napi.delete_reference = ResolveNodeApi<NapiDeleteReference>(
      "napi_delete_reference");
  napi.add_env_cleanup_hook = ResolveNodeApi<NapiAddEnvCleanupHook>(
      "napi_add_env_cleanup_hook");
  napi.open_handle_scope = ResolveNodeApi<NapiOpenHandleScope>(
      "napi_open_handle_scope");
  napi.close_handle_scope = ResolveNodeApi<NapiCloseHandleScope>(
      "napi_close_handle_scope");
  napi.create_function = ResolveNodeApi<NapiCreateFunction>(
      "napi_create_function");
  napi.set_named_property = ResolveNodeApi<NapiSetNamedProperty>(
      "napi_set_named_property");
  napi.throw_error = ResolveNodeApi<NapiThrowError>("napi_throw_error");
  napi.throw_type_error = ResolveNodeApi<NapiThrowTypeError>(
      "napi_throw_type_error");
  return napi.get_callback_info && napi.is_buffer && napi.get_buffer_info &&
      napi.get_boolean && napi.type_of && napi.get_undefined && napi.create_string_utf8 &&
      napi.call_function && napi.create_reference &&
      napi.get_reference_value && napi.delete_reference &&
      napi.add_env_cleanup_hook && napi.open_handle_scope &&
      napi.close_handle_scope && napi.create_function &&
      napi.set_named_property && napi.throw_error && napi.throw_type_error;
}

bool CheckNapi(napi_env env, napi_status status, const char* message) {
  if (status == napi_ok) return true;
  napi.throw_error(env, nullptr, message);
  return false;
}

HWND ResolveWindowValue(napi_env env, napi_value argument) {
  bool is_buffer = false;
  if (!CheckNapi(
          env,
          napi.is_buffer(env, argument, &is_buffer),
          "Could not inspect the native window handle.") ||
      !is_buffer) {
    napi.throw_type_error(
        env,
        nullptr,
        "The native window handle must be an Electron Buffer.");
    return nullptr;
  }

  void* bytes = nullptr;
  size_t byte_length = 0;
  if (!CheckNapi(
          env,
          napi.get_buffer_info(env, argument, &bytes, &byte_length),
          "Could not read the native window handle.") ||
      byte_length < sizeof(HWND)) {
    napi.throw_type_error(env, nullptr, "The native window handle is invalid.");
    return nullptr;
  }

  HWND window = nullptr;
  std::memcpy(&window, bytes, sizeof(window));
  if (!window) {
    napi.throw_type_error(env, nullptr, "The native window handle is empty.");
    return nullptr;
  }
  return window;
}

HWND ResolveWindow(napi_env env, napi_callback_info info) {
  size_t argument_count = 1;
  napi_value argument = nullptr;
  if (!CheckNapi(
          env,
          napi.get_callback_info(
              env,
              info,
              &argument_count,
              &argument,
              nullptr,
              nullptr),
          "Could not read the native window argument.")) {
    return nullptr;
  }
  if (argument_count < 1) {
    napi.throw_type_error(env, nullptr, "A native window handle is required.");
    return nullptr;
  }
  return ResolveWindowValue(env, argument);
}

struct ExternalFullscreenMonitorState {
  napi_env env = nullptr;
  napi_ref callback = nullptr;
  HWND application_window = nullptr;
  HWND blocking_window = nullptr;
  HWND explicitly_activated_over = nullptr;
  HWINEVENTHOOK foreground_hook = nullptr;
  HWINEVENTHOOK destroy_hook = nullptr;
  HWINEVENTHOOK location_hook = nullptr;
  HWINEVENTHOOK minimize_hook = nullptr;
  HWINEVENTHOOK reorder_hook = nullptr;
  HWINEVENTHOOK visibility_hook = nullptr;
  HWINEVENTHOOK cloak_hook = nullptr;
  bool dispatching = false;
};

ExternalFullscreenMonitorState monitor;

void StopExternalFullscreenMonitor(bool delete_callback) {
  if (monitor.foreground_hook) UnhookWinEvent(monitor.foreground_hook);
  if (monitor.destroy_hook) UnhookWinEvent(monitor.destroy_hook);
  if (monitor.location_hook) UnhookWinEvent(monitor.location_hook);
  if (monitor.minimize_hook) UnhookWinEvent(monitor.minimize_hook);
  if (monitor.reorder_hook) UnhookWinEvent(monitor.reorder_hook);
  if (monitor.visibility_hook) UnhookWinEvent(monitor.visibility_hook);
  if (monitor.cloak_hook) UnhookWinEvent(monitor.cloak_hook);
  monitor.foreground_hook = nullptr;
  monitor.destroy_hook = nullptr;
  monitor.location_hook = nullptr;
  monitor.minimize_hook = nullptr;
  monitor.reorder_hook = nullptr;
  monitor.visibility_hook = nullptr;
  monitor.cloak_hook = nullptr;
  monitor.application_window = nullptr;
  monitor.blocking_window = nullptr;
  monitor.explicitly_activated_over = nullptr;
  monitor.dispatching = false;
  if (delete_callback && monitor.env && monitor.callback) {
    napi.delete_reference(monitor.env, monitor.callback);
  }
  monitor.callback = nullptr;
  monitor.env = nullptr;
}

void CleanupExternalFullscreenMonitor(void*) {
  // The environment is already shutting down, so release Win32 resources but
  // do not call back into Node-API to delete the now-owned reference.
  StopExternalFullscreenMonitor(false);
}

bool CoversMonitor(HWND window) {
  RECT bounds = {};
  if (!GetWindowRect(window, &bounds)) return false;

  const HMONITOR monitor = MonitorFromWindow(window, MONITOR_DEFAULTTONULL);
  if (!monitor) return false;
  MONITORINFO monitor_info = {};
  monitor_info.cbSize = sizeof(monitor_info);
  if (!GetMonitorInfoW(monitor, &monitor_info)) return false;

  const RECT& monitor_bounds = monitor_info.rcMonitor;
  const LONG monitor_width = monitor_bounds.right - monitor_bounds.left;
  const LONG monitor_height = monitor_bounds.bottom - monitor_bounds.top;
  const LONG edge_tolerance = max(
      MINIMUM_FULLSCREEN_EDGE_TOLERANCE,
      min(monitor_width, monitor_height) / 200);

  // Maximized Win32 windows often extend their invisible resize frame beyond
  // the monitor by several pixels. Borderless games can do the same, or leave
  // a tiny scaling seam. Requiring exact equality delays suppression until a
  // later focus transition even though the game already occupies the screen.
  // Check that every monitor edge is covered instead. A taskbar-sized work-area
  // gap remains well outside this small adaptive tolerance.
  return bounds.left <= monitor_bounds.left + edge_tolerance &&
      bounds.top <= monitor_bounds.top + edge_tolerance &&
      bounds.right >= monitor_bounds.right - edge_tolerance &&
      bounds.bottom >= monitor_bounds.bottom - edge_tolerance;
}

bool IsCloakedWindow(HWND window) {
  DWORD cloaked = 0;
  return SUCCEEDED(DwmGetWindowAttribute(window, DWMWA_CLOAKED, &cloaked, sizeof(cloaked))) &&
      cloaked != 0;
}

bool IsExternalWindow(HWND window, HWND application_root) {
  if (!window || window == application_root ||
      !IsWindow(window) || !IsWindowVisible(window) || IsIconic(window) ||
      IsCloakedWindow(window)) {
    return false;
  }
  DWORD process_id = 0;
  GetWindowThreadProcessId(window, &process_id);
  return process_id != 0 && process_id != GetCurrentProcessId();
}

bool IsShellSurfaceWindow(HWND window) {
  if (!window || window == GetDesktopWindow() || window == GetShellWindow()) {
    return true;
  }

  wchar_t class_name[64] = {};
  if (GetClassNameW(window, class_name, 64) == 0) return false;
  return wcscmp(class_name, L"Progman") == 0 ||
      wcscmp(class_name, L"WorkerW") == 0 ||
      wcscmp(class_name, L"Shell_TrayWnd") == 0 ||
      wcscmp(class_name, L"Shell_SecondaryTrayWnd") == 0;
}

bool IsOrdinaryMaximizedWindow(HWND window) {
  WINDOWPLACEMENT placement = {};
  placement.length = sizeof(placement);
  return GetWindowPlacement(window, &placement) &&
      placement.showCmd == SW_SHOWMAXIMIZED;
}

bool SharesApplicationMonitor(HWND window, HWND application_root) {
  // A fullscreen game only owns the z-order of its own monitor. Keep
  // Kawaikara topmost when it is placed on another display. For a window that
  // spans displays, Windows chooses the monitor with the largest intersection.
  const HMONITOR window_monitor = MonitorFromWindow(
      window,
      MONITOR_DEFAULTTONEAREST);
  const HMONITOR application_monitor = MonitorFromWindow(
      application_root,
      MONITOR_DEFAULTTONEAREST);
  return window_monitor && window_monitor == application_monitor;
}

bool IsNewFullscreenBlocker(HWND window, HWND application_root) {
  if (!IsExternalWindow(window, application_root) ||
      IsShellSurfaceWindow(window) ||
      IsOrdinaryMaximizedWindow(window) ||
      !SharesApplicationMonitor(window, application_root) ||
      !CoversMonitor(window)) {
    return false;
  }

  const LONG_PTR style = GetWindowLongPtrW(window, GWL_STYLE);
  const LONG_PTR extended_style = GetWindowLongPtrW(window, GWL_EXSTYLE);
  // Cursor/capture overlays can span every display, but cannot own fullscreen
  // input. Likewise, cloaked windows on another virtual desktop are not owners.
  if ((extended_style & (WS_EX_NOACTIVATE | WS_EX_TRANSPARENT)) != 0) return false;
  // A maximized ordinary window can cover the monitor including its invisible
  // resize frame. SHQueryUserNotificationState cannot disambiguate it here:
  // that value is global, so a game on display 1 reports D3D fullscreen while
  // a captioned app on display 2 owns the foreground. Restrict the blocker to
  // the borderless top-level shape used by exclusive/borderless fullscreen
  // windows and explicitly ignore Explorer desktop surfaces above.
  return (style & WS_CHILD) == 0 && (style & WS_CAPTION) == 0;
}

struct FullscreenOwnerSearch {
  HWND application_root = nullptr;
  HWND fullscreen_window = nullptr;
};

BOOL CALLBACK FindDisplayFullscreenOwner(HWND window, LPARAM data) {
  auto& search = *reinterpret_cast<FullscreenOwnerSearch*>(data);
  if (!IsNewFullscreenBlocker(window, search.application_root)) return TRUE;
  search.fullscreen_window = window;
  return FALSE;
}

void ObserveFullscreenActivation(HWND foreground, HWND application_root) {
  if (!monitor.blocking_window || !foreground) return;
  if (foreground == application_root ||
      GetAncestor(foreground, GA_ROOTOWNER) == application_root) {
    monitor.explicitly_activated_over = monitor.blocking_window;
  } else if (IsNewFullscreenBlocker(foreground, application_root)) {
    // Clicking the game on THIS display revokes the user's explicit raise.
    // Focusing an ordinary app on another display deliberately preserves it.
    monitor.explicitly_activated_over = nullptr;
  }
}

bool IsExternalFullscreenActive(HWND application_window) {
  const HWND application_root = application_window
      ? GetAncestor(application_window, GA_ROOT)
      : nullptr;
  if (!application_root) {
    monitor.blocking_window = nullptr;
    monitor.explicitly_activated_over = nullptr;
    return false;
  }

  // Foreground ownership is global, fullscreen ownership is per display.
  // Focusing another monitor must not release this display. Inspect live
  // z-order so multiple games, monitor moves and a game closing reveal the
  // actual uppermost fullscreen window, not a stale foreground snapshot.
  FullscreenOwnerSearch search{application_root};
  EnumWindows(FindDisplayFullscreenOwner, reinterpret_cast<LPARAM>(&search));
  if (search.fullscreen_window != monitor.blocking_window) {
    monitor.explicitly_activated_over = nullptr;
  }
  monitor.blocking_window = search.fullscreen_window;
  ObserveFullscreenActivation(GetAncestor(GetForegroundWindow(), GA_ROOT), application_root);
  return monitor.blocking_window != nullptr;
}

bool IsApplicationWindowTopmost(HWND application_window) {
  const HWND application_root = application_window
      ? GetAncestor(application_window, GA_ROOT)
      : nullptr;
  return application_root && IsWindow(application_root) &&
      (GetWindowLongPtrW(application_root, GWL_EXSTYLE) & WS_EX_TOPMOST) != 0;
}

struct FullscreenYieldSearch {
  HWND application_root = nullptr;
  HWND fullscreen_window = nullptr;
  DWORD application_process = 0;
  DWORD fullscreen_process = 0;
  bool application_above = false;
  bool found_fullscreen = false;
  HWND anchor = nullptr;
};

BOOL CALLBACK FindFullscreenYieldAnchor(HWND window, LPARAM data) {
  auto& search = *reinterpret_cast<FullscreenYieldSearch*>(data);
  if (window == search.fullscreen_window) {
    search.found_fullscreen = true;
    return search.application_above ? TRUE : FALSE;
  }
  DWORD process_id = 0;
  GetWindowThreadProcessId(window, &process_id);
  if (process_id == search.application_process) {
    const bool viewer_group = window == search.application_root ||
        GetAncestor(window, GA_ROOTOWNER) == search.application_root;
    if (!search.found_fullscreen && viewer_group &&
        SharesApplicationMonitor(window, search.application_root) &&
        IsWindowVisible(window) && !IsIconic(window)) {
      search.application_above = true;
    }
    return TRUE;
  }
  if (search.found_fullscreen &&
      !IsShellSurfaceWindow(window) &&
      (GetWindowLongPtrW(window, GWL_EXSTYLE) & WS_EX_TOPMOST) == 0) {
    // Electron.moveAbove(anchor) actually inserts after anchor's predecessor.
    // Referencing the fullscreen game's HWND there can leave the z-order
    // unchanged (observed with protected fullscreen games), even though Electron
    // reports no error. Choose a normal predecessor below the game instead.
    const HWND predecessor = GetWindow(window, GW_HWNDPREV);
    DWORD predecessor_process = 0;
    if (predecessor) GetWindowThreadProcessId(predecessor, &predecessor_process);
    if (predecessor && predecessor_process != 0 &&
        predecessor_process != search.application_process &&
        predecessor_process != search.fullscreen_process &&
        !IsShellSurfaceWindow(predecessor) &&
        !IsNewFullscreenBlocker(predecessor, search.application_root) &&
        (GetWindowLongPtrW(predecessor, GWL_EXSTYLE) & WS_EX_TOPMOST) == 0) {
      search.anchor = window;
      return FALSE;
    }
  }
  return TRUE;
}

HWND GetExternalFullscreenYieldTarget(HWND application_window) {
  const HWND application_root = GetAncestor(application_window, GA_ROOT);
  // Explicit activation is remembered for this fullscreen owner. Keep the
  // viewer at normal z-order even after another display receives focus, until
  // the user returns to fullscreen here or this display's owner changes.
  if (!application_root || !IsExternalFullscreenActive(application_window) ||
      monitor.explicitly_activated_over == monitor.blocking_window) {
    return nullptr;
  }
  FullscreenYieldSearch search;
  search.application_root = application_root;
  search.fullscreen_window = monitor.blocking_window;
  GetWindowThreadProcessId(application_root, &search.application_process);
  GetWindowThreadProcessId(search.fullscreen_window, &search.fullscreen_process);
  // EnumWindows supplies top-level z-order without an unbounded GetWindow
  // traversal. Include owned application windows: an overlay can remain above
  // the game even when the viewer's own topmost bit is already cleared.
  EnumWindows(FindFullscreenYieldAnchor, reinterpret_cast<LPARAM>(&search));
  // Return an observation only. Main uses Electron.moveAbove(anchor) to place
  // its own window below the game, without activating or moving the game.
  return search.anchor;
}

napi_value GetExternalFullscreenYieldTargetCallback(napi_env env, napi_callback_info info) {
  const HWND application_window = ResolveWindow(env, info);
  if (!application_window) return nullptr;
  const HWND anchor = GetExternalFullscreenYieldTarget(application_window);
  napi_value result = nullptr;
  if (!anchor) {
    napi.get_undefined(env, &result);
    return result;
  }
  char source_id[64] = {};
  std::snprintf(source_id, sizeof(source_id), "window:%llu:0",
      static_cast<unsigned long long>(reinterpret_cast<uintptr_t>(anchor)));
  if (!CheckNapi(env, napi.create_string_utf8(env, source_id, NAPI_AUTO_LENGTH, &result),
      "Could not return the fullscreen yield target.")) return nullptr;
  return result;
}

void DispatchExternalFullscreenState() {
  if (!monitor.env || !monitor.callback || monitor.dispatching) return;
  monitor.dispatching = true;

  napi_handle_scope scope = nullptr;
  if (napi.open_handle_scope(monitor.env, &scope) != napi_ok) {
    monitor.dispatching = false;
    return;
  }
  napi_value callback = nullptr;
  napi_value receiver = nullptr;
  if (napi.get_reference_value(
          monitor.env,
          monitor.callback,
          &callback) == napi_ok &&
      napi.get_undefined(monitor.env, &receiver) == napi_ok) {
    napi.call_function(
        monitor.env,
        receiver,
        callback,
        0,
        nullptr,
        nullptr);
  }
  napi.close_handle_scope(monitor.env, scope);
  monitor.dispatching = false;
}

void CALLBACK HandleWindowEvent(
    HWINEVENTHOOK,
    DWORD event,
    HWND window,
    LONG object_id,
    LONG child_id,
    DWORD,
    DWORD) {
  if (!monitor.callback) return;
  if (event == EVENT_SYSTEM_FOREGROUND) {
    // Observe display ownership before notification coalescing. A short
    // foreground roundtrip cannot discard a still-visible fullscreen window.
    IsExternalFullscreenActive(monitor.application_window);
    ObserveFullscreenActivation(GetAncestor(window, GA_ROOT),
        GetAncestor(monitor.application_window, GA_ROOT));
  } else if (event == EVENT_OBJECT_REORDER) {
    if (object_id != OBJID_WINDOW || child_id != CHILDID_SELF || !window) {
      return;
    }
    const HWND changed_root = GetAncestor(window, GA_ROOT);
    const HWND application_root = GetAncestor(
        monitor.application_window,
        GA_ROOT);
    if (changed_root != application_root && changed_root != monitor.blocking_window &&
        !IsNewFullscreenBlocker(changed_root, application_root)) return;
  } else if (event == EVENT_OBJECT_LOCATIONCHANGE) {
    if (object_id != OBJID_WINDOW || child_id != CHILDID_SELF || !window) {
      return;
    }
    const HWND changed_root = GetAncestor(window, GA_ROOT);
    const HWND foreground_root = GetAncestor(GetForegroundWindow(), GA_ROOT);
    if (!changed_root ||
        (changed_root != foreground_root &&
         changed_root != monitor.blocking_window &&
         !IsNewFullscreenBlocker(changed_root, GetAncestor(monitor.application_window, GA_ROOT)))) {
      return;
    }
  } else if (event == EVENT_OBJECT_SHOW || event == EVENT_OBJECT_HIDE ||
             event == EVENT_OBJECT_CLOAKED || event == EVENT_OBJECT_UNCLOAKED) {
    if (object_id != OBJID_WINDOW || child_id != CHILDID_SELF || !window) return;
    const HWND changed_root = GetAncestor(window, GA_ROOT);
    if (window != monitor.blocking_window && changed_root != monitor.blocking_window &&
        !IsNewFullscreenBlocker(changed_root, GetAncestor(monitor.application_window, GA_ROOT))) return;
  } else if (event == EVENT_OBJECT_DESTROY) {
    const HWND changed_root = GetAncestor(window, GA_ROOT);
    if (window != monitor.blocking_window &&
        changed_root != monitor.blocking_window) {
      return;
    }
  } else if (event == EVENT_SYSTEM_MINIMIZESTART ||
             event == EVENT_SYSTEM_MINIMIZEEND) {
    const HWND changed_root = GetAncestor(window, GA_ROOT);
    const HWND foreground_root = GetAncestor(GetForegroundWindow(), GA_ROOT);
    if (changed_root != monitor.blocking_window &&
        changed_root != foreground_root) {
      return;
    }
  }
  DispatchExternalFullscreenState();
}

napi_value StartExternalFullscreenMonitorCallback(
    napi_env env,
    napi_callback_info info) {
  size_t argument_count = 2;
  napi_value arguments[2] = {};
  if (!CheckNapi(
          env,
          napi.get_callback_info(
              env,
              info,
              &argument_count,
              arguments,
              nullptr,
              nullptr),
          "Could not read the fullscreen monitor arguments.")) {
    return nullptr;
  }
  if (argument_count < 2) {
    napi.throw_type_error(
        env,
        nullptr,
        "A native window handle and callback are required.");
    return nullptr;
  }

  const HWND application_window = ResolveWindowValue(env, arguments[0]);
  if (!application_window) return nullptr;
  int callback_type = 0;
  if (!CheckNapi(
          env,
          napi.type_of(env, arguments[1], &callback_type),
          "Could not inspect the fullscreen monitor callback.") ||
      callback_type != napi_function) {
    napi.throw_type_error(
        env,
        nullptr,
        "The fullscreen monitor callback must be a function.");
    return nullptr;
  }

  StopExternalFullscreenMonitor(true);
  monitor.env = env;
  monitor.application_window = application_window;
  if (!CheckNapi(
          env,
          napi.create_reference(env, arguments[1], 1, &monitor.callback),
          "Could not retain the fullscreen monitor callback.")) {
    StopExternalFullscreenMonitor(false);
    return nullptr;
  }

  constexpr DWORD flags = WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS;
  monitor.foreground_hook = SetWinEventHook(
      EVENT_SYSTEM_FOREGROUND,
      EVENT_SYSTEM_FOREGROUND,
      nullptr,
      HandleWindowEvent,
      0,
      0,
      flags);
  monitor.destroy_hook = SetWinEventHook(
      EVENT_OBJECT_DESTROY,
      EVENT_OBJECT_DESTROY,
      nullptr,
      HandleWindowEvent,
      0,
      0,
      flags);
  monitor.location_hook = SetWinEventHook(
      EVENT_OBJECT_LOCATIONCHANGE,
      EVENT_OBJECT_LOCATIONCHANGE,
      nullptr,
      HandleWindowEvent,
      0,
      0,
      flags);
  monitor.minimize_hook = SetWinEventHook(
      EVENT_SYSTEM_MINIMIZESTART,
      EVENT_SYSTEM_MINIMIZEEND,
      nullptr,
      HandleWindowEvent,
      0,
      0,
      flags);
  // Windows can remove WS_EX_TOPMOST from an Electron window while another
  // application owns fullscreen presentation. Observe the application
  // window's z-order changes as a signal only; Electron remains responsible
  // for restoring its own presentation. Do not skip the owning process here,
  // because the accessibility event is associated with the reordered HWND
  // even when the shell initiated the change.
  monitor.reorder_hook = SetWinEventHook(
      EVENT_OBJECT_REORDER,
      EVENT_OBJECT_REORDER,
      nullptr,
      HandleWindowEvent,
      0,
      0,
      WINEVENT_OUTOFCONTEXT);
  monitor.visibility_hook = SetWinEventHook(
      EVENT_OBJECT_SHOW, EVENT_OBJECT_HIDE, nullptr, HandleWindowEvent, 0, 0, flags);
  monitor.cloak_hook = SetWinEventHook(
      EVENT_OBJECT_CLOAKED, EVENT_OBJECT_UNCLOAKED, nullptr, HandleWindowEvent, 0, 0, flags);
  if (!monitor.foreground_hook || !monitor.destroy_hook ||
      !monitor.location_hook || !monitor.minimize_hook ||
      !monitor.reorder_hook || !monitor.visibility_hook || !monitor.cloak_hook) {
    StopExternalFullscreenMonitor(true);
    napi.throw_error(
        env,
        nullptr,
        "Could not register the Windows fullscreen event hooks.");
    return nullptr;
  }

  napi_value result = nullptr;
  if (!CheckNapi(
          env,
          napi.get_boolean(
              env,
              IsExternalFullscreenActive(application_window),
              &result),
          "Could not return the initial fullscreen monitor state.")) {
    StopExternalFullscreenMonitor(true);
    return nullptr;
  }
  return result;
}

napi_value IsApplicationWindowTopmostCallback(
    napi_env env,
    napi_callback_info info) {
  const HWND application_window = ResolveWindow(env, info);
  if (!application_window) return nullptr;

  napi_value result = nullptr;
  if (!CheckNapi(
          env,
          napi.get_boolean(
              env,
              IsApplicationWindowTopmost(application_window),
              &result),
          "Could not return the application topmost state.")) {
    return nullptr;
  }
  return result;
}

napi_value StopExternalFullscreenMonitorCallback(
    napi_env env,
    napi_callback_info) {
  StopExternalFullscreenMonitor(true);
  napi_value result = nullptr;
  if (!CheckNapi(
          env,
          napi.get_undefined(env, &result),
          "Could not stop the fullscreen monitor.")) {
    return nullptr;
  }
  return result;
}

napi_value IsExternalFullscreenActiveCallback(
    napi_env env,
    napi_callback_info info) {
  const HWND application_window = ResolveWindow(env, info);
  if (!application_window) return nullptr;

  napi_value result = nullptr;
  if (!CheckNapi(
          env,
          napi.get_boolean(
              env,
              IsExternalFullscreenActive(application_window),
              &result),
          "Could not return the external fullscreen state.")) {
    return nullptr;
  }
  return result;
}

void ExportFunction(
    napi_env env,
    napi_value exports,
    const char* name,
    napi_callback callback) {
  napi_value function = nullptr;
  if (napi.create_function(
          env,
          name,
          NAPI_AUTO_LENGTH,
          callback,
          nullptr,
          &function) == napi_ok) {
    napi.set_named_property(env, exports, name, function);
  }
}

}  // namespace

extern "C" __declspec(dllexport)
int32_t node_api_module_get_api_version_v1() {
  return 1;
}

extern "C" __declspec(dllexport)
napi_value napi_register_module_v1(napi_env env, napi_value exports) {
  if (!LoadNodeApi()) return exports;
  napi.add_env_cleanup_hook(env, CleanupExternalFullscreenMonitor, nullptr);
  ExportFunction(
      env,
      exports,
      "isExternalFullscreenActive",
      IsExternalFullscreenActiveCallback);
  ExportFunction(
      env,
      exports,
      "isApplicationWindowTopmost",
      IsApplicationWindowTopmostCallback);
  ExportFunction(
      env,
      exports,
      "getExternalFullscreenYieldTarget",
      GetExternalFullscreenYieldTargetCallback);
  ExportFunction(
      env,
      exports,
      "startExternalFullscreenMonitor",
      StartExternalFullscreenMonitorCallback);
  ExportFunction(
      env,
      exports,
      "stopExternalFullscreenMonitor",
      StopExternalFullscreenMonitorCallback);
  return exports;
}
