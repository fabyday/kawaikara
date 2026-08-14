import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process';
import { promisify } from 'node:util';
import { screen, type BrowserWindow, type Rectangle } from 'electron';

const execFileAsync = promisify(execFile);
const MINIMUM_DISPLAY_COVERAGE = 0.985;
const MAXIMUM_FULLSCREEN_EDGE_GAP = 12;

interface WindowSnapshot {
  readonly bounds: Rectangle;
  readonly coversTarget?: boolean;
  readonly id: string;
  readonly layer: number;
  readonly monitor?: string;
  readonly onTargetMonitor?: boolean;
  readonly pid: number;
}

export interface WindowTrackingBaseline {
  readonly available: boolean;
  readonly ids: ReadonlySet<string>;
}

export type TrackedWindowVisibility =
  | 'visible'
  | 'occluded'
  | 'missing'
  | 'unknown';

export interface TrackedWindowObservation {
  readonly displayId?: string;
  readonly visibility: TrackedWindowVisibility;
}

const MACOS_WINDOW_LIST_SCRIPT = String.raw`
ObjC.import('CoreGraphics');
// 17 = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements.
const reference = $.CGWindowListCopyWindowInfo(17, 0);
const windows = ObjC.deepUnwrap(ObjC.castRefToObject(reference));
JSON.stringify(windows
  .filter((item) => item.kCGWindowAlpha > 0)
  .map((item) => ({
    id: String(item.kCGWindowNumber),
    pid: item.kCGWindowOwnerPID,
    layer: item.kCGWindowLayer,
    bounds: {
      x: item.kCGWindowBounds.X,
      y: item.kCGWindowBounds.Y,
      width: item.kCGWindowBounds.Width,
      height: item.kCGWindowBounds.Height,
    },
  })));
`;

const WINDOWS_WINDOW_LIST_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class KawaikaraWindowProbe {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  public struct Rect {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  public sealed class Snapshot {
    public string id { get; set; }
    public uint pid { get; set; }
    public string monitor { get; set; }
    public bool onTargetMonitor { get; set; }
    public bool coversTarget { get; set; }
    public int x { get; set; }
    public int y { get; set; }
    public int width { get; set; }
    public int height { get; set; }
  }

  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  private static extern bool GetWindowRect(IntPtr hWnd, out Rect rect);

  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

  [DllImport("user32.dll")]
  private static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  private struct MonitorInfo {
    public int size;
    public Rect monitor;
    public Rect workArea;
    public uint flags;
  }

  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);

  [DllImport("dwmapi.dll")]
  private static extern int DwmGetWindowAttribute(
    IntPtr hWnd,
    int attribute,
    out int value,
    int size
  );

  public static List<Snapshot> GetVisibleWindows(IntPtr viewerWindow) {
    var result = new List<Snapshot>();
    var targetMonitor = MonitorFromWindow(viewerWindow, 2);
    var target = new MonitorInfo { size = Marshal.SizeOf(typeof(MonitorInfo)) };
    if (targetMonitor == IntPtr.Zero || !GetMonitorInfo(targetMonitor, ref target)) {
      return result;
    }
    EnumWindows((hWnd, lParam) => {
      if (!IsWindowVisible(hWnd)) return true;
      var windowMonitor = MonitorFromWindow(hWnd, 2);
      if (windowMonitor == IntPtr.Zero) return true;
      int cloaked = 0;
      if (DwmGetWindowAttribute(hWnd, 14, out cloaked, sizeof(int)) == 0 && cloaked != 0) {
        return true;
      }
      Rect rect;
      if (!GetWindowRect(hWnd, out rect)) return true;
      var width = rect.Right - rect.Left;
      var height = rect.Bottom - rect.Top;
      if (width <= 0 || height <= 0) return true;
      var windowMonitorInfo = new MonitorInfo {
        size = Marshal.SizeOf(typeof(MonitorInfo))
      };
      if (!GetMonitorInfo(windowMonitor, ref windowMonitorInfo)) return true;
      const int edgeGap = 12;
      var coversTarget =
        rect.Left <= windowMonitorInfo.monitor.Left + edgeGap &&
        rect.Top <= windowMonitorInfo.monitor.Top + edgeGap &&
        rect.Right >= windowMonitorInfo.monitor.Right - edgeGap &&
        rect.Bottom >= windowMonitorInfo.monitor.Bottom - edgeGap;
      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      result.Add(new Snapshot {
        id = hWnd.ToInt64().ToString(),
        pid = pid,
        monitor = windowMonitor.ToInt64().ToString(),
        onTargetMonitor = windowMonitor == targetMonitor,
        coversTarget = coversTarget,
        x = rect.Left,
        y = rect.Top,
        width = width,
        height = height,
      });
      return true;
    }, IntPtr.Zero);
    return result;
  }
}
'@
$viewerHandle = [IntPtr]([long]::Parse($env:KAWAIKARA_VIEWER_HANDLE))
while ($null -ne ($command = [Console]::In.ReadLine())) {
  if ($command -ne 'query') { continue }
  try {
    $json = [KawaikaraWindowProbe]::GetVisibleWindows($viewerHandle) |
      ConvertTo-Json -Compress
    if ([string]::IsNullOrWhiteSpace($json)) { $json = '[]' }
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
  } catch {
    [Console]::Out.WriteLine('[]')
    [Console]::Out.Flush()
  }
}
`;

export class FullscreenWindowDetector {
  private readonly windowsProbe = new WindowsWindowProbe();

  dispose(): void {
    this.windowsProbe.dispose();
  }

  async hasExternalFullscreenWindow(
    viewerWindow: BrowserWindow,
  ): Promise<boolean> {
    const displayBounds = screen.getDisplayMatching(viewerWindow.getBounds()).bounds;
    const windows = await this.readWindowSnapshots(viewerWindow);
    return windows.some(
      (window) =>
        window.pid !== process.pid &&
        window.layer === 0 &&
        (process.platform === 'win32'
          ? window.onTargetMonitor === true && window.coversTarget === true
          : coversDisplay(window.bounds, displayBounds)),
    );
  }

  async captureBaseline(
    viewerWindow: BrowserWindow,
  ): Promise<WindowTrackingBaseline> {
    const windows = await this.readWindowSnapshots(viewerWindow);
    return {
      available: windows.length > 0,
      ids: new Set(windows.map(({ id }) => id)),
    };
  }

  async findNewPictureInPictureWindow(
    viewerWindow: BrowserWindow,
    baseline: WindowTrackingBaseline,
    expectedSize?: { readonly width: number; readonly height: number },
  ): Promise<string | undefined> {
    if (!baseline.available) return undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) await delay(80);
      const displayBounds = screen.getDisplayMatching(
        viewerWindow.getBounds(),
      ).bounds;
      const windows = await this.readWindowSnapshots(viewerWindow);
      const candidates = windows
        .filter(
          (window) =>
            !baseline.ids.has(window.id) &&
            window.bounds.width >= 120 &&
            window.bounds.height >= 68 &&
            window.bounds.width * window.bounds.height <
              displayBounds.width * displayBounds.height * 0.8,
        )
        .sort(
          (left, right) =>
            pictureInPictureCandidateScore(right, expectedSize) -
            pictureInPictureCandidateScore(left, expectedSize),
        );
      if (candidates[0]) return candidates[0].id;
    }
    return undefined;
  }

  async getTrackedWindowVisibility(
    viewerWindow: BrowserWindow,
    windowId: string,
  ): Promise<TrackedWindowObservation> {
    const windows = await this.readWindowSnapshots(viewerWindow);
    if (windows.length === 0) return { visibility: 'unknown' };
    const trackedIndex = windows.findIndex(({ id }) => id === windowId);
    if (trackedIndex < 0) return { visibility: 'missing' };
    const trackedWindow = windows[trackedIndex];
    const electronBounds =
      process.platform === 'win32'
        ? screen.screenToDipRect(null, trackedWindow.bounds)
        : trackedWindow.bounds;
    const trackedDisplay = screen.getDisplayMatching(electronBounds);
    const displayBounds = trackedDisplay.bounds;
    const occluded = windows.slice(0, trackedIndex).some(
      (window) =>
        window.pid !== process.pid &&
        window.layer === 0 &&
        (process.platform === 'win32' && trackedWindow.monitor
          ? window.monitor === trackedWindow.monitor &&
            window.coversTarget === true
          : coversDisplay(window.bounds, displayBounds)),
    );
    return {
      displayId: String(trackedDisplay.id),
      visibility: occluded ? 'occluded' : 'visible',
    };
  }

  private async readWindowSnapshots(
    viewerWindow: BrowserWindow,
  ): Promise<WindowSnapshot[]> {
    try {
      if (process.platform === 'darwin') return await readMacOSWindows();
      if (process.platform === 'win32') {
        return parseWindowSnapshots(
          await this.windowsProbe.query(viewerWindow),
        );
      }
    } catch (error) {
      console.debug('Fullscreen window detection was unavailable.', error);
    }
    return [];
  }
}

async function readMacOSWindows(): Promise<WindowSnapshot[]> {
  const { stdout } = await execFileAsync(
    '/usr/bin/osascript',
    ['-l', 'JavaScript', '-e', MACOS_WINDOW_LIST_SCRIPT],
    { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 1200 },
  );
  return parseWindowSnapshots(stdout);
}

interface PendingWindowsProbeQuery {
  readonly reject: (error: Error) => void;
  readonly resolve: (value: string) => void;
  readonly timer: NodeJS.Timeout;
}

class WindowsWindowProbe {
  private buffer = '';
  private child?: ChildProcessWithoutNullStreams;
  private nativeHandle?: string;
  private readonly pending: PendingWindowsProbeQuery[] = [];

  query(viewerWindow: BrowserWindow): Promise<string> {
    const nativeHandle = readNativeWindowHandle(viewerWindow);
    if (!this.child || this.nativeHandle !== nativeHandle) {
      this.dispose();
      this.start(nativeHandle);
    }
    const child = this.child;
    if (!child) return Promise.reject(new Error('Windows probe did not start.'));
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.pending.findIndex(
          (candidate) => candidate.resolve === resolve,
        );
        if (index >= 0) this.pending.splice(index, 1);
        reject(new Error('Windows probe query timed out.'));
        this.dispose();
      }, 2500);
      timer.unref();
      this.pending.push({ resolve, reject, timer });
      child.stdin.write('query\n');
    });
  }

  dispose(): void {
    const child = this.child;
    this.child = undefined;
    this.nativeHandle = undefined;
    this.buffer = '';
    if (child && !child.killed) child.kill();
    this.rejectPending(new Error('Windows probe stopped.'));
  }

  private start(nativeHandle: string): void {
    const child = spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        WINDOWS_WINDOW_LIST_SCRIPT,
      ],
      {
        env: { ...process.env, KAWAIKARA_VIEWER_HANDLE: nativeHandle },
        windowsHide: true,
      },
    );
    this.child = child;
    this.nativeHandle = nativeHandle;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => this.readOutput(chunk));
    child.on('error', (error) => {
      if (this.child === child) this.child = undefined;
      this.rejectPending(error);
    });
    child.on('exit', () => {
      if (this.child === child) this.child = undefined;
      this.rejectPending(new Error('Windows probe exited.'));
    });
  }

  private readOutput(chunk: string): void {
    this.buffer += chunk;
    for (;;) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      const query = this.pending.shift();
      if (!query) continue;
      clearTimeout(query.timer);
      query.resolve(line);
    }
  }

  private rejectPending(error: Error): void {
    for (const query of this.pending.splice(0)) {
      clearTimeout(query.timer);
      query.reject(error);
    }
  }
}

function readNativeWindowHandle(viewerWindow: BrowserWindow): string {
  const handle = viewerWindow.getNativeWindowHandle();
  return handle.length >= 8
    ? handle.readBigUInt64LE().toString()
    : String(handle.readUInt32LE());
}

function parseWindowSnapshots(value: string): WindowSnapshot[] {
  const parsed = JSON.parse(value || '[]') as unknown;
  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const value = candidate as {
      bounds?: unknown;
      coversTarget?: unknown;
      height?: unknown;
      id?: unknown;
      layer?: unknown;
      monitor?: unknown;
      onTargetMonitor?: unknown;
      pid?: unknown;
      width?: unknown;
      x?: unknown;
      y?: unknown;
    };
    const id = String(value.id ?? '');
    const rawBounds =
      value.bounds && typeof value.bounds === 'object'
        ? (value.bounds as Record<string, unknown>)
        : value;
    const bounds = {
      x: Number(rawBounds.x),
      y: Number(rawBounds.y),
      width: Number(rawBounds.width),
      height: Number(rawBounds.height),
    };
    const layer = Number(value.layer ?? 0);
    const pid = Number(value.pid);
    return id &&
      Number.isFinite(pid) &&
      Number.isFinite(layer) &&
      isValidRectangle(bounds)
      ? [
          {
            id,
            pid,
            layer,
            bounds,
            coversTarget: value.coversTarget === true,
            monitor:
              typeof value.monitor === 'string' ? value.monitor : undefined,
            onTargetMonitor: value.onTargetMonitor === true,
          },
        ]
      : [];
  });
}

function pictureInPictureCandidateScore(
  window: WindowSnapshot,
  expectedSize?: { readonly width: number; readonly height: number },
): number {
  if (!expectedSize) return window.layer * 1_000 - window.bounds.width;
  const sizeDifference =
    Math.abs(window.bounds.width - expectedSize.width) +
    Math.abs(window.bounds.height - expectedSize.height);
  // Chromium may create native PiP in a renderer/helper process. Prefer the
  // new window whose dimensions match PictureInPictureWindow instead of
  // assuming the Electron main PID owns it. Layer is only a tie breaker so a
  // small notification window cannot outrank the matching PiP window.
  return -sizeDifference * 1_000 + Math.min(window.layer, 999);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isValidRectangle(value: Rectangle): boolean {
  return (
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height) &&
    value.width > 0 &&
    value.height > 0
  );
}

function coversDisplay(window: Rectangle, display: Rectangle): boolean {
  const left = Math.max(window.x, display.x);
  const top = Math.max(window.y, display.y);
  const right = Math.min(window.x + window.width, display.x + display.width);
  const bottom = Math.min(window.y + window.height, display.y + display.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const displayArea = display.width * display.height;
  return (
    displayArea > 0 &&
    intersection / displayArea >= MINIMUM_DISPLAY_COVERAGE &&
    window.x <= display.x + MAXIMUM_FULLSCREEN_EDGE_GAP &&
    window.y <= display.y + MAXIMUM_FULLSCREEN_EDGE_GAP &&
    window.x + window.width >=
      display.x + display.width - MAXIMUM_FULLSCREEN_EDGE_GAP &&
    window.y + window.height >=
      display.y + display.height - MAXIMUM_FULLSCREEN_EDGE_GAP
  );
}
