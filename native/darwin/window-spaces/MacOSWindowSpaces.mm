#import <AppKit/AppKit.h>
#import <objc/runtime.h>
#import "PiPExitRecovery.h"

#include <cstddef>
#include <cstdint>
#include <cstring>

// This add-on intentionally declares the small Node-API surface it uses.
// Node-API is ABI-stable, and avoiding Node/V8 headers lets the same universal
// binary load in both Electron architectures without downloading build headers.
extern "C" {
struct napi_env__;
struct napi_value__;
struct napi_callback_info__;
using napi_env = napi_env__*;
using napi_value = napi_value__*;
using napi_callback_info = napi_callback_info__*;
using napi_status = int;
using napi_callback = napi_value (*)(napi_env, napi_callback_info);

constexpr napi_status napi_ok = 0;
constexpr size_t NAPI_AUTO_LENGTH = static_cast<size_t>(-1);

napi_status napi_get_cb_info(
    napi_env,
    napi_callback_info,
    size_t*,
    napi_value*,
    napi_value*,
    void**);
napi_status napi_is_buffer(napi_env, napi_value, bool*);
napi_status napi_get_buffer_info(napi_env, napi_value, void**, size_t*);
napi_status napi_create_string_utf8(napi_env, const char*, size_t, napi_value*);
napi_status napi_get_undefined(napi_env, napi_value*);
napi_status napi_create_function(
    napi_env,
    const char*,
    size_t,
    napi_callback,
    void*,
    napi_value*);
napi_status napi_set_named_property(napi_env, napi_value, const char*, napi_value);
napi_status napi_throw_error(napi_env, const char*, const char*);
napi_status napi_throw_type_error(napi_env, const char*, const char*);
}

// Owned by the native PiP window, with weak notification callbacks so closing or
// leaving PiP releases observers and cancels delayed work without a JS callback.
@interface KawaikaraPiPSpaceObserver : NSObject
@property(nonatomic, weak) NSWindow* window;
@property(nonatomic) NSWindowCollectionBehavior originalBehavior;
@property(nonatomic) BOOL active;
@property(nonatomic) NSUInteger generation;
@property(nonatomic) NSUInteger refreshCount;
@property(nonatomic, strong) NSMutableArray* workspaceTokens;
@property(nonatomic, strong) id closeToken;
@property(nonatomic, strong) KawaikaraPiPExitRecovery* exitRecovery;
- (instancetype)initWithWindow:(NSWindow*)window;
- (void)apply;
- (void)stop;
@end

@implementation KawaikaraPiPSpaceObserver
- (instancetype)initWithWindow:(NSWindow*)window {
  if ((self = [super init])) {
    _window = window;
    _originalBehavior = window.collectionBehavior;
    _active = YES;
    _workspaceTokens = [NSMutableArray array];
    _exitRecovery = [[KawaikaraPiPExitRecovery alloc] init];
    __weak KawaikaraPiPSpaceObserver* weakSelf = self;
    NSNotificationCenter* center = NSWorkspace.sharedWorkspace.notificationCenter;
    for (NSString* name in @[NSWorkspaceActiveSpaceDidChangeNotification,
                             NSWorkspaceDidActivateApplicationNotification]) {
      id token = [center addObserverForName:name object:nil queue:NSOperationQueue.mainQueue
          usingBlock:^(NSNotification* notification) {
            KawaikaraPiPSpaceObserver* owner = weakSelf;
            if (!owner.active) return;
            const NSUInteger generation = ++owner.generation;
            ++owner.refreshCount;
            [owner apply];
            // Inspect after this main-loop turn without a fixed settling delay.
            // A newer notification or PiP teardown cancels obsolete callbacks.
            dispatch_async(dispatch_get_main_queue(), ^{
              KawaikaraPiPSpaceObserver* current = weakSelf;
              if (current.active && current.generation == generation)
                [current.exitRecovery observeWindow:current.window];
            });
            // Native full-screen transitions may finish after the notification.
            for (NSNumber* delay in @[@0.25, @1.0]) {
              dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay.doubleValue * NSEC_PER_SEC)),
                  dispatch_get_main_queue(), ^{
                    KawaikaraPiPSpaceObserver* current = weakSelf;
                    if (current.active && current.generation == generation) {
                      [current apply];
                      [current.exitRecovery observeWindow:current.window];
                    }
                  });
            }
          }];
      [_workspaceTokens addObject:token];
    }
    _closeToken = [NSNotificationCenter.defaultCenter
        addObserverForName:NSWindowWillCloseNotification object:window queue:NSOperationQueue.mainQueue
        usingBlock:^(NSNotification* notification) { [weakSelf stop]; }];
  }
  return self;
}
- (void)apply {
  NSWindow* window = self.window;
  if (!self.active || !window) return;
  NSWindowCollectionBehavior behavior = window.collectionBehavior;
  // Electron's fullscreenable:false can leave FullScreenNone set. These policies
  // are mutually exclusive; OR-ing Auxiliary onto it does not establish a policy.
  behavior &= ~(NSWindowCollectionBehaviorMoveToActiveSpace |
                NSWindowCollectionBehaviorFullScreenPrimary |
                NSWindowCollectionBehaviorFullScreenNone);
  behavior |= NSWindowCollectionBehaviorCanJoinAllSpaces |
              NSWindowCollectionBehaviorFullScreenAuxiliary;
  if (@available(macOS 13.0, *)) {
    behavior &= ~(NSWindowCollectionBehaviorPrimary | NSWindowCollectionBehaviorAuxiliary);
    behavior |= NSWindowCollectionBehaviorCanJoinAllApplications;
  }
  window.collectionBehavior = behavior;
  window.level = NSScreenSaverWindowLevel;
  // Do not resurrect a hidden/closing window or activate its app during a game.
  if (window.visible && !window.miniaturized) [window orderFrontRegardless];
}
- (void)stop {
  if (!self.active) return;
  self.active = NO;
  ++self.generation;
  for (id token in self.workspaceTokens)
    [NSWorkspace.sharedWorkspace.notificationCenter removeObserver:token];
  [self.workspaceTokens removeAllObjects];
  if (self.closeToken) [NSNotificationCenter.defaultCenter removeObserver:self.closeToken];
  self.closeToken = nil;
  if (self.window) self.window.collectionBehavior = self.originalBehavior;
}
- (void)dealloc {
  for (id token in _workspaceTokens)
    [NSWorkspace.sharedWorkspace.notificationCenter removeObserver:token];
  if (_closeToken) [NSNotificationCenter.defaultCenter removeObserver:_closeToken];
}
@end

static char kPiPSpaceObserverKey;

namespace {

template <typename Value>
bool CheckNapi(napi_env env, Value status, const char* message) {
  if (status == napi_ok) return true;
  napi_throw_error(env, nullptr, message);
  return false;
}

NSWindow* ResolveWindow(
    napi_env env,
    napi_callback_info info,
    napi_value* second_argument = nullptr) {
  size_t argument_count = second_argument ? 2 : 1;
  napi_value arguments[2] = {};
  if (!CheckNapi(
          env,
          napi_get_cb_info(
              env,
              info,
              &argument_count,
              arguments,
              nullptr,
              nullptr),
          "Could not read native window arguments.")) {
    return nil;
  }
  if (argument_count < (second_argument ? 2u : 1u)) {
    napi_throw_type_error(env, nullptr, "A native window handle is required.");
    return nil;
  }

  bool is_buffer = false;
  if (!CheckNapi(
          env,
          napi_is_buffer(env, arguments[0], &is_buffer),
          "Could not inspect the native window handle.") ||
      !is_buffer) {
    napi_throw_type_error(
        env,
        nullptr,
        "The native window handle must be an Electron Buffer.");
    return nil;
  }

  void* bytes = nullptr;
  size_t byte_length = 0;
  if (!CheckNapi(
          env,
          napi_get_buffer_info(env, arguments[0], &bytes, &byte_length),
          "Could not read the native window handle.") ||
      byte_length < sizeof(void*)) {
    napi_throw_type_error(env, nullptr, "The native window handle is invalid.");
    return nil;
  }

  void* native_pointer = nullptr;
  memcpy(&native_pointer, bytes, sizeof(native_pointer));
  if (!native_pointer) {
    napi_throw_type_error(env, nullptr, "The native window handle is empty.");
    return nil;
  }

  id native_object = (__bridge id)native_pointer;
  NSWindow* window = nil;
  if ([native_object isKindOfClass:[NSWindow class]]) {
    window = static_cast<NSWindow*>(native_object);
  } else if ([native_object isKindOfClass:[NSView class]]) {
    window = [static_cast<NSView*>(native_object) window];
  }
  if (!window) {
    napi_throw_type_error(
        env,
        nullptr,
        "Electron did not provide an NSView or NSWindow handle.");
    return nil;
  }
  if (second_argument) *second_argument = arguments[1];
  return window;
}

napi_value SetFullScreenAuxiliary(
    napi_env env,
    napi_callback_info info) {
  NSWindow* window = ResolveWindow(env, info);
  if (!window) return nullptr;

  KawaikaraPiPSpaceObserver* observer = objc_getAssociatedObject(window, &kPiPSpaceObserverKey);
  if (!observer.active) {
    observer = [[KawaikaraPiPSpaceObserver alloc] initWithWindow:window];
    objc_setAssociatedObject(window, &kPiPSpaceObserverKey, observer, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  [observer apply];

  napi_value result = nullptr;
  napi_get_undefined(env, &result);
  return result;
}

napi_value ClearFullScreenAuxiliary(
    napi_env env,
    napi_callback_info info) {
  NSWindow* window = ResolveWindow(env, info);
  if (!window) return nullptr;

  KawaikaraPiPSpaceObserver* observer = objc_getAssociatedObject(window, &kPiPSpaceObserverKey);
  [observer stop];
  objc_setAssociatedObject(window, &kPiPSpaceObserverKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  window.collectionBehavior &= ~NSWindowCollectionBehaviorFullScreenAuxiliary;

  napi_value result = nullptr;
  napi_get_undefined(env, &result);
  return result;
}

// Read-only diagnostics for Space transition regression tests and support tooling.
napi_value GetWindowSpaceState(napi_env env, napi_callback_info info) {
  NSWindow* window = ResolveWindow(env, info);
  if (!window) return nullptr;
  KawaikaraPiPSpaceObserver* observer = objc_getAssociatedObject(window, &kPiPSpaceObserverKey);
  NSDictionary* state = @{
    @"visible": @(window.visible),
    @"onActiveSpace": @(window.onActiveSpace),
    @"occlusionVisible": @((window.occlusionState & NSWindowOcclusionStateVisible) != 0),
    @"behavior": @(window.collectionBehavior),
    @"watching": @(observer.active),
    @"refreshCount": @(observer.refreshCount),
    @"appActive": @(NSApp.active)
  };
  NSData* json = [NSJSONSerialization dataWithJSONObject:state options:0 error:nil];
  napi_value result = nullptr;
  napi_create_string_utf8(env, static_cast<const char*>(json.bytes), json.length, &result);
  return result;
}

void ExportFunction(
    napi_env env,
    napi_value exports,
    const char* name,
    napi_callback callback) {
  napi_value function = nullptr;
  if (napi_create_function(
          env,
          name,
          NAPI_AUTO_LENGTH,
          callback,
          nullptr,
          &function) == napi_ok) {
    napi_set_named_property(env, exports, name, function);
  }
}

}  // namespace

extern "C" __attribute__((visibility("default")))
int32_t node_api_module_get_api_version_v1() {
  return 1;
}

extern "C" __attribute__((visibility("default")))
napi_value napi_register_module_v1(napi_env env, napi_value exports) {
  ExportFunction(
      env,
      exports,
      "setFullScreenAuxiliary",
      SetFullScreenAuxiliary);
  ExportFunction(
      env,
      exports,
      "clearFullScreenAuxiliary",
      ClearFullScreenAuxiliary);
  ExportFunction(env, exports, "getWindowSpaceState", GetWindowSpaceState);
  return exports;
}
