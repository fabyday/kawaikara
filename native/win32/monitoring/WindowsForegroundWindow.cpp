#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <cstddef>
#include <cstdint>
#include <cstring>

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
      napi.get_boolean && napi.type_of && napi.get_undefined &&
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
  HWINEVENTHOOK foreground_hook = nullptr;
  HWINEVENTHOOK destroy_hook = nullptr;
  HWINEVENTHOOK location_hook = nullptr;
  HWINEVENTHOOK minimize_hook = nullptr;
  HWINEVENTHOOK reorder_hook = nullptr;
  bool dispatching = false;
};

ExternalFullscreenMonitorState monitor;

void StopExternalFullscreenMonitor(bool delete_callback) {
  if (monitor.foreground_hook) UnhookWinEvent(monitor.foreground_hook);
  if (monitor.destroy_hook) UnhookWinEvent(monitor.destroy_hook);
  if (monitor.location_hook) UnhookWinEvent(monitor.location_hook);
  if (monitor.minimize_hook) UnhookWinEvent(monitor.minimize_hook);
  if (monitor.reorder_hook) UnhookWinEvent(monitor.reorder_hook);
  monitor.foreground_hook = nullptr;
  monitor.destroy_hook = nullptr;
  monitor.location_hook = nullptr;
  monitor.minimize_hook = nullptr;
  monitor.reorder_hook = nullptr;
  monitor.application_window = nullptr;
  monitor.blocking_window = nullptr;
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

bool IsExternalWindow(HWND window, HWND application_root) {
  if (!window || window == application_root ||
      !IsWindow(window) || !IsWindowVisible(window) || IsIconic(window)) {
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
  // A maximized ordinary window can cover the monitor including its invisible
  // resize frame. SHQueryUserNotificationState cannot disambiguate it here:
  // that value is global, so a game on display 1 reports D3D fullscreen while
  // a captioned app on display 2 owns the foreground. Restrict the blocker to
  // the borderless top-level shape used by exclusive/borderless fullscreen
  // windows and explicitly ignore Explorer desktop surfaces above.
  return (style & WS_CHILD) == 0 && (style & WS_CAPTION) == 0;
}

bool IsRememberedFullscreenBlocker(HWND window, HWND application_root) {
  // Notification state describes the current foreground application. Once a
  // window has been confirmed as fullscreen, geometry is the reliable signal
  // while Kawaikara itself temporarily owns the foreground.
  return IsExternalWindow(window, application_root) &&
      !IsShellSurfaceWindow(window) &&
      !IsOrdinaryMaximizedWindow(window) &&
      SharesApplicationMonitor(window, application_root) &&
      CoversMonitor(window);
}

bool IsExternalFullscreenActive(HWND application_window) {
  const HWND application_root = application_window
      ? GetAncestor(application_window, GA_ROOT)
      : nullptr;
  if (!application_root) {
    monitor.blocking_window = nullptr;
    return false;
  }

  const HWND foreground = GetAncestor(GetForegroundWindow(), GA_ROOT);
  if (IsExternalWindow(foreground, application_root)) {
    if (IsNewFullscreenBlocker(foreground, application_root)) {
      monitor.blocking_window = foreground;
      return true;
    }
    monitor.blocking_window = nullptr;
    return false;
  }

  if (IsRememberedFullscreenBlocker(
          monitor.blocking_window,
          application_root)) {
    return true;
  }
  monitor.blocking_window = nullptr;
  return false;
}

bool IsApplicationWindowTopmost(HWND application_window) {
  const HWND application_root = application_window
      ? GetAncestor(application_window, GA_ROOT)
      : nullptr;
  return application_root && IsWindow(application_root) &&
      (GetWindowLongPtrW(application_root, GWL_EXSTYLE) & WS_EX_TOPMOST) != 0;
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
  if (event == EVENT_OBJECT_REORDER) {
    if (object_id != OBJID_WINDOW || child_id != CHILDID_SELF || !window) {
      return;
    }
    const HWND changed_root = GetAncestor(window, GA_ROOT);
    const HWND application_root = GetAncestor(
        monitor.application_window,
        GA_ROOT);
    if (changed_root != application_root) return;
  } else if (event == EVENT_OBJECT_LOCATIONCHANGE) {
    if (object_id != OBJID_WINDOW || child_id != CHILDID_SELF || !window) {
      return;
    }
    const HWND changed_root = GetAncestor(window, GA_ROOT);
    const HWND foreground_root = GetAncestor(GetForegroundWindow(), GA_ROOT);
    if (!changed_root ||
        (changed_root != foreground_root &&
         changed_root != monitor.blocking_window)) {
      return;
    }
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
  if (!monitor.foreground_hook || !monitor.destroy_hook ||
      !monitor.location_hook || !monitor.minimize_hook ||
      !monitor.reorder_hook) {
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
      "startExternalFullscreenMonitor",
      StartExternalFullscreenMonitorCallback);
  ExportFunction(
      env,
      exports,
      "stopExternalFullscreenMonitor",
      StopExternalFullscreenMonitorCallback);
  return exports;
}
