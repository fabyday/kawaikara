#pragma once
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#include "PiPExitRecoveryPolicy.h"

/** Event-driven fullscreen transition recovery for the PiP display.
 * Uses window geometry, without titles, screenshots, AX calls or periodic probes.
 */
@interface KawaikaraPiPExitRecovery : NSObject {
  kawaikara::pip::ExitRecoveryState state_;
  BOOL recovering_;
}
/** Inspect the visible window stack on the PiP display and recover one transition.
 * @param window Live PiP NSWindow, called on the AppKit main thread. Hidden or
 * minimized windows are ignored. Active/key PiP consumes an edge without cycling
 * its order, preserving the user's interaction and keyboard focus.
 */
- (void)observeWindow:(NSWindow*)window;
@end

@implementation KawaikaraPiPExitRecovery
- (void)observeWindow:(NSWindow*)window {
  if (recovering_ || !window || !window.visible || window.miniaturized) return;
  CGDirectDisplayID display = [window.screen.deviceDescription[@"NSScreenNumber"] unsignedIntValue];
  if (!display || !CGDisplayIsActive(display)) return;
  CGRect bounds = CGDisplayBounds(display);
  NSArray* windows = CFBridgingRelease(CGWindowListCopyWindowInfo(
      kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID));
  std::vector<kawaikara::pip::WindowSnapshot> candidates;
  for (NSDictionary* info in windows) {
    if ([info[(id)kCGWindowOwnerPID] intValue] == NSProcessInfo.processInfo.processIdentifier ||
        [info[(id)kCGWindowLayer] intValue] != 0 ||
        [info[(id)kCGWindowAlpha] doubleValue] <= 0) continue;
    CGRect rect;
    if (CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)info[(id)kCGWindowBounds], &rect))
      candidates.push_back({{rect.origin.x, rect.origin.y, rect.size.width, rect.size.height},
          [info[(id)kCGWindowNumber] unsignedIntValue]});
  }
  const auto snapshot = kawaikara::pip::ClassifyDisplay(
      {bounds.origin.x, bounds.origin.y, bounds.size.width, bounds.size.height}, candidates);
  const bool exited = state_.Observe(display, snapshot);
  if (!exited) return;
  if (window.keyWindow || NSApp.active) {
    return;
  }
  recovering_ = YES;
  const NSWindowAnimationBehavior animation = window.animationBehavior;
  @try {
    window.animationBehavior = NSWindowAnimationBehaviorNone;
    [NSAnimationContext runAnimationGroup:^(NSAnimationContext* context) {
      context.duration = 0;
      context.allowsImplicitAnimation = NO;
      [window orderOut:nil];
      [window orderFrontRegardless];
    } completionHandler:nil];
  } @finally {
    window.animationBehavior = animation;
    recovering_ = NO;
  }
}
@end
