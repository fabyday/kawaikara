#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>

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
using napi_env = napi_env__*;
using napi_value = napi_value__*;
using napi_callback_info = napi_callback_info__*;
using napi_status = int;
using napi_callback = napi_value (*)(napi_env, napi_callback_info);
}

namespace {

constexpr napi_status napi_ok = 0;
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
  napi.create_function = ResolveNodeApi<NapiCreateFunction>(
      "napi_create_function");
  napi.set_named_property = ResolveNodeApi<NapiSetNamedProperty>(
      "napi_set_named_property");
  napi.throw_error = ResolveNodeApi<NapiThrowError>("napi_throw_error");
  napi.throw_type_error = ResolveNodeApi<NapiThrowTypeError>(
      "napi_throw_type_error");
  return napi.get_callback_info && napi.is_buffer && napi.get_buffer_info &&
      napi.get_boolean && napi.create_function && napi.set_named_property &&
      napi.throw_error && napi.throw_type_error;
}

bool CheckNapi(napi_env env, napi_status status, const char* message) {
  if (status == napi_ok) return true;
  napi.throw_error(env, nullptr, message);
  return false;
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

bool IsExternalFullscreenForeground(HWND application_window) {
  HWND foreground = GetForegroundWindow();
  if (!foreground || !IsWindowVisible(foreground) || IsIconic(foreground)) {
    return false;
  }

  foreground = GetAncestor(foreground, GA_ROOT);
  const HWND application_root = application_window
      ? GetAncestor(application_window, GA_ROOT)
      : nullptr;
  if (foreground == application_root) return false;

  DWORD foreground_process_id = 0;
  GetWindowThreadProcessId(foreground, &foreground_process_id);
  if (foreground_process_id == GetCurrentProcessId()) return false;

  // A fullscreen game only owns the z-order of its own monitor. Keep
  // Kawaikara topmost when it is placed on another display. For a window that
  // spans displays, Windows chooses the monitor with the largest intersection.
  const HMONITOR foreground_monitor = MonitorFromWindow(
      foreground,
      MONITOR_DEFAULTTONEAREST);
  const HMONITOR application_monitor = MonitorFromWindow(
      application_root,
      MONITOR_DEFAULTTONEAREST);
  if (!foreground_monitor || foreground_monitor != application_monitor) {
    return false;
  }

  if (!CoversMonitor(foreground)) return false;

  const LONG_PTR style = GetWindowLongPtrW(foreground, GWL_STYLE);
  if ((style & WS_CAPTION) == 0) return true;

  QUERY_USER_NOTIFICATION_STATE notification_state = QUNS_ACCEPTS_NOTIFICATIONS;
  return SUCCEEDED(SHQueryUserNotificationState(&notification_state)) &&
      (notification_state == QUNS_BUSY ||
       notification_state == QUNS_RUNNING_D3D_FULL_SCREEN);
}

napi_value IsExternalFullscreenForegroundCallback(
    napi_env env,
    napi_callback_info info) {
  const HWND application_window = ResolveWindow(env, info);
  if (!application_window) return nullptr;

  napi_value result = nullptr;
  if (!CheckNapi(
          env,
          napi.get_boolean(
              env,
              IsExternalFullscreenForeground(application_window),
              &result),
          "Could not return the fullscreen foreground state.")) {
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
  ExportFunction(
      env,
      exports,
      "isExternalFullscreenForeground",
      IsExternalFullscreenForegroundCallback);
  return exports;
}
