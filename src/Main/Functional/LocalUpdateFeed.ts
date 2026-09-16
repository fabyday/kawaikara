/** Accepts an explicit loopback-only feed for packaged update testing. */
export function resolveLocalUpdateFeed(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('KAWAIKARA_LOCAL_UPDATE_URL must be a valid URL.');
  }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1'
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('KAWAIKARA_LOCAL_UPDATE_URL must be an unauthenticated http://127.0.0.1:<port>/ URL.');
  }
  return url.href.endsWith('/') ? url.href : `${url.href}/`;
}
