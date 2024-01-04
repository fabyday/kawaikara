const { dialog, app} = require('electron')
const log = require('electron-log');
const {autoUpdater} = require("electron-updater");
let updater = null;
autoUpdater.autoDownload = false;
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('updater App starting...');

autoUpdater.on('error', (error) => {
  dialog.showErrorBox('Error: ', error == null ? "unknown" : (error.stack || error).toString())
})

function setup_pogress_bar(window){

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
      updater.enabled = true
      updater = null
    }
  })
})

autoUpdater.on('update-not-available', () => {
  dialog.showMessageBox({
    title: 'No Updates',
    message: 'Current version is up-to-date.'
  })
  updater.enabled = true
  updater = null
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
function checkForUpdates (menuItem, focusedWindow, event) {
  updater = menuItem
  updater.enabled = false
  autoUpdater.checkForUpdates()
}
module.exports.checkForUpdates = checkForUpdates
module.exports.setProgressBar = setup_pogress_bar