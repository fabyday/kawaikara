// Imports
const { contextBridge, ipcRenderer } = require('electron')
console.log('test')
contextBridge.exposeInMainWorld('kwaikara_api', {
    fullscreen: url => ipcRenderer.send('full-screen', url),
    open_url: url => ipcRenderer.send('open-url', url),
})
