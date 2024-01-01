// Imports
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kwaikara-api', {
    fullscreen: url => ipcRenderer.send('full-screen', url),
    open_url: url => ipcRenderer.send('open-url', url),
})
