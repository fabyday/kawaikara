#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

namespace kawaikara::pip {
/** Classification of the uppermost substantial external window on one display.
 * Fullscreen means display-sized geometry, not macOS Game Mode or a Space ID.
 */
enum class Coverage { unknown = -1, normal = 0, fullscreen = 1 };

/** Global display coordinates from CoreGraphics, in points. */
struct Rect { double x, y, width, height; };

/** Stable WindowServer window number and bounds; two windows in one app differ. */
struct WindowSnapshot { Rect bounds; uint32_t id; };

/** Geometry classification plus the selected window, or zero when unknown. */
struct DisplaySnapshot {
  Coverage coverage = Coverage::unknown;
  uint32_t window = 0;
};

/** Classify front-to-back external layer-zero bounds against the PiP display.
 * @param display The complete bounds of the display containing PiP.
 * @param windows Visible external window bounds in WindowServer stacking order.
 * Other displays and intersections smaller than 100 points are ignored. A tiny
 * overlap must not make a window on monitor 2 disarm monitor 1's fullscreen state.
 */
inline DisplaySnapshot ClassifyDisplay(Rect display, const std::vector<WindowSnapshot>& windows) {
  for (const WindowSnapshot& candidate : windows) {
    const Rect& w = candidate.bounds;
    const double width = std::min(display.x + display.width, w.x + w.width) - std::max(display.x, w.x);
    const double height = std::min(display.y + display.height, w.y + w.height) - std::max(display.y, w.y);
    if (width < 100 || height < 100) continue;
    const bool fills = std::abs(w.x - display.x) <= 2 && std::abs(w.y - display.y) <= 2 &&
        std::abs(w.width - display.width) <= 2 && std::abs(w.height - display.height) <= 2;
    return {fills ? Coverage::fullscreen : Coverage::normal, candidate.id};
  }
  return {};
}

/** Tracks the PiP display independently of the globally active application.
 * @remarks Unknown samples retain the previous known state. Moving PiP to a
 * different display (including removal/fallback) resets history without recovery.
 * Leaving a fullscreen window, either for a normal window or a different
 * fullscreen window, is consumed once. App activation alone cannot identify
 * this edge because two fullscreen windows may belong to the same app.
 */
class ExitRecoveryState {
 public:
  /** @returns True once when leaving the known fullscreen window on this display. */
  bool Observe(uint32_t display, DisplaySnapshot current) {
    if (display != display_) {
      display_ = display;
      previous_ = current;
      return false;
    }
    if (current.coverage == Coverage::unknown) return false;
    // Missing identity is not proof of a different fullscreen window. Preserve
    // the known ID until metadata becomes available, avoiding a spurious cycle.
    if (current.coverage == Coverage::fullscreen && current.window == 0 &&
        previous_.coverage == Coverage::fullscreen) return false;
    const bool switchedFullscreen = current.coverage == Coverage::fullscreen &&
        previous_.window != 0 && current.window != 0 && previous_.window != current.window;
    const bool exited = previous_.coverage == Coverage::fullscreen &&
        (current.coverage == Coverage::normal || switchedFullscreen);
    previous_ = current;
    return exited;
  }
 private:
  uint32_t display_ = 0;
  DisplaySnapshot previous_;
};
}  // namespace kawaikara::pip
