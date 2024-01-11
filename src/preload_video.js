// Imports
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kwaikara-api', {
    open_url: (event, sourceId,scaleFactor,size) => ipcRenderer.send('open-url', event, sourceId,scaleFactor,size),
})
