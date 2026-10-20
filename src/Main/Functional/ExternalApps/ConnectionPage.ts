/** Copy supplied by the app locale, with English fallback for standalone bridges. */
export interface ConnectionPageLabels {
    /** The page store pending value. */
    pageStorePending: string;
    /** The page waiting value. */
    pageWaiting: string;
    /** The page missing value. */
    pageMissing: string;
    /** The page install value. */
    pageInstall: string;
    /** The page instructions value. */
    pageInstructions: string;
    /** The page mode hint value. */
    pageModeHint: string;
    /** The page development value. */
    pageDevelopment: string;
    /** The page production value. */
    pageProduction: string;
}
/** Stores the fallback value. */
const fallback: ConnectionPageLabels = {
    /** The page store pending value. */
    pageStorePending: 'The store listing is being prepared. Installation links will be available after publication.',
    /** The page waiting value. */
    pageWaiting: 'Waiting for the extension…',
    /** The page missing value. */
    pageMissing:
        'Install or enable the extension in this browser, then try again.',
    /** The page install value. */
    pageInstall: 'Install Kawaikara WebExtension',
    /** The page instructions value. */
    pageInstructions:
        'Chrome: open chrome://extensions and load the built extension folder. Firefox: open about:debugging and load its manifest.json.',
    /** The page mode hint value. */
    pageModeHint:
        'Enable development connection in extension advanced settings when the app selects development connection.',
    /** The page development value. */
    pageDevelopment: 'Development connection',
    /** The page production value. */
    pageProduction: 'Standard connection',
};
/** Performs the escape operation. */
function escape(value: string) {
    return value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character]!,
    );
}
/** A compact image-first panel matching the desktop updater. */
export function connectionPage(
    labels: ConnectionPageLabels = fallback,
): string {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kawaikara WebExtension</title><link rel="stylesheet" href="/extension-connect.css"></head>
    <body><main><img src="/extension-connect.png" alt="Kawaikara"><section><h1>Kawaikara WebExtension</h1><p id="connection-mode" data-development="${escape(labels.pageDevelopment)}" data-production="${escape(labels.pageProduction)}"></p><div class="status-slot"><p id="connection-status" role="status">${escape(labels.pageWaiting)}</p></div><p class="muted" data-development-only hidden>${escape(labels.pageModeHint)}</p>
    <section id="installation" hidden><h2>${escape(labels.pageInstall)}</h2><p>${escape(labels.pageMissing)}</p><p data-production-only hidden>${escape(labels.pageStorePending)}</p><p data-development-only hidden>${escape(labels.pageInstructions)}</p><p data-development-only hidden><code>dist/chrome</code> · <code>dist/development/chrome</code><br><code>dist/firefox/manifest.json</code></p></section>
    </section></main><script src="/extension-connect-status.js"></script></body></html>`;
}
/** Stores the connection page CSS value. */
export const connectionPageCss = `:root{color-scheme:dark;font:14px/1.6 system-ui,sans-serif;color:#eeedf4;background:#101016}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 15%,#7656a840,transparent 65%)}main{width:min(440px,100%);border:1px solid #ffffff20;border-radius:18px;overflow:hidden;background:#202027;box-shadow:0 24px 80px #0005}img{width:100%;aspect-ratio:2/1;display:block;object-fit:contain;background:#f5f5f4}main>section{padding:22px;text-align:center}h1{font-size:19px;margin:0 0 8px}h2{font-size:16px}.status-slot{min-height:76px;display:grid;place-items:center}p{margin:8px 0;overflow-wrap:anywhere}.muted{font-size:12px;color:#aca7ba}#connection-mode{font-size:12px;color:#c4afea}#installation{border-top:1px solid #ffffff20;margin-top:18px;padding-top:12px;text-align:left;animation:enter .2s ease-out}#installation p{font-size:13px}code{font-size:11px}@keyframes enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){#installation{animation:none}}`;
/** Stores the connection page script value. */
export const connectionPageScript = `const mode=document.getElementById('connection-mode');const development=location.hash.endsWith(':development');mode.textContent=development?mode.dataset.development:mode.dataset.production;document.querySelectorAll('[data-development-only]').forEach(node=>node.hidden=!development);document.querySelectorAll('[data-production-only]').forEach(node=>node.hidden=development);setTimeout(()=>{const node=document.getElementById('connection-status');if(node&&!node.dataset.adapter){node.textContent=document.querySelector('#installation p').textContent;document.getElementById('installation').hidden=false;}},10000);`;
