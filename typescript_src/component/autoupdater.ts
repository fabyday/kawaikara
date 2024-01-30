import { dialog, app } from "electron";
import log from "electron-log/main";
import { BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater"


log.transports.file.level = "debug"
autoUpdater.autoDownload = false;
autoUpdater.logger = log;
log.info('updater App starting...');

autoUpdater.on('error', (error) => {
  dialog.showErrorBox('Error: ', error == null ? "unknown" : (error.stack || error).toString())
})

export function setup_pogress_bar(window : BrowserWindow){

  autoUpdater.on('download-progress', (progress) => {
    // log.info(`${progress.progress}, ${progress.bytesPerSecond}, ${progress.percent},${progress.total},${progress.transferred}`)
      window.setProgressBar(progress.percent*0.01)
  })
}
  

autoUpdater.on('update-available', () => {
  log.info('updater')
  dialog.showMessageBox({
    type: 'info',
    title: 'Found Updates',
    message: 'Found updates, do you want update now?',
    buttons: ['Yes', 'No']
  }).then((buttonIndex) => {
    
    log.info(` button index is ${buttonIndex.response}`)
    if (buttonIndex.response === 0) {
      log.info('download start')
      autoUpdater.downloadUpdate()
      log.info('download end')

    }
    else {
      log.info('disable download')
    //   autoUpdater.enabled = true
    //   updater = null
    }
  })
})

autoUpdater.on('update-not-available', () => {
  dialog.showMessageBox({
    title: 'No Updates',
    message: 'Current version is up-to-date.'
  })
})

autoUpdater.on('update-downloaded', () => {
  log.info("update downloaded...")
  dialog.showMessageBox({
    title: 'Install Updates',
    message: 'Updates downloaded, application will be quit for update...'
  }).then(() => {
    log.info("update install...")
    setImmediate(() => autoUpdater.quitAndInstall())
  })
})



// export this to MenuItem click callback
export function checkForUpdates (menuItem : any, focusedWindow : any, event : any) {
//   updater = menuItem
//   updater.enabled = false
  autoUpdater.checkForUpdates()
}
