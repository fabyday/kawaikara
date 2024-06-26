const {injectBrowserAction} = require("electron-chrome-extensions/dist/browser-action")
// Inject <browser-action-list> element into WebUI
injectBrowserAction()
console.log("electron extension was preloaded")