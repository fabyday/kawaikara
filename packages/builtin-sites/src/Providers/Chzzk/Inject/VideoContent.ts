/** Provider-owned classification and main-video selection, consumed by optional Plugins. */
export function resolveChzzkVideoContent(): {
  /** The video value. */
  video: HTMLVideoElement | null;
  /** The kind value. */
  kind: string;
  /** The key value. */
  key: string } {
  const path = location.pathname;
  const kind = /^\/clips\//.test(path) ? 'short' : /^\/live\//.test(path) ? 'live'
    : /^\/video\//.test(path) ? 'vod' : 'unknown';
  const candidates = Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
    .filter(video => {
      if (video.closest('[class*="adVideo"], [class*="ad-video"], [data-ad]')) return false;
      const box = video.getBoundingClientRect();
      const style = getComputedStyle(video);
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    })
    .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
  return {
    /** The video value. */
    video: candidates[0] ?? null,
    /** The kind value. */
    kind,
    /** The key value. */
    key: path };
}
