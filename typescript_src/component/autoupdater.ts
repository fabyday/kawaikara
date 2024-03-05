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

const on_update_available =() => {
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
}
const on_update_not_available = () => {
  dialog.showMessageBox({
    title: 'No Updates',
    message: 'Current version is up-to-date.'
  })
}
const on_update_downloaded =() => {
  log.info("update downloaded...")
  dialog.showMessageBox({
    title: 'Install Updates',
    message: 'Updates downloaded, application will be quit for update...'
  }).then(() => {
    log.info("update install...")
    setImmediate(() => autoUpdater.quitAndInstall())
  })
}


export function unset_autoupdater(){
    autoUpdater.removeListener('update-available', on_update_available)
    autoUpdater.removeListener('update-not-available',on_update_not_available)
    autoUpdater.removeListener('update-downloaded',on_update_downloaded)
}

export function set_autoupdater(){
autoUpdater.on('update-available', on_update_available)

autoUpdater.on('update-not-available', on_update_not_available)

autoUpdater.on('update-downloaded', on_update_downloaded)
}


// export this to MenuItem click callback
export function checkForUpdates () {
  autoUpdater.checkForUpdates()
}
