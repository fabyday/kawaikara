const {app, BrowserWindow,dialog, components, ipcMain, ipcRenderer, Menu, MenuItem} = require('electron');
// * `widevinecdm.dll` on Windows.
// app.commandLine.appendSwitch('widevine-cdm-path', 'C:\\Program Files\\Google\\Chrome\\Application\\120.0.6099.130\\WidevineCdm\\_platform_specific\\win_x64\\widevinecdm.dll')
// // The version of plugin can be got from `chrome://components` page in Chrome.
// app.commandLine.appendSwitch('widevine-cdm-version', '1.0.2738.0')
app.commandLine.appendSwitch('auto-detect', 'false');
app.commandLine.appendSwitch('no-proxy-server')

const path = require('node:path')
const laftel = require('./scripts/laftel')
let mainWindow =null
function check_item(mitem, win, event){
  if (mitem.label == "netflix")
    mainWindow.loadURL('https://netflix.com/');
  else if(mitem.label == "laftel"){
    mainWindow.loadURL('https://laftel.net/');
  }else if(mitem.label == "disney"){
    mainWindow.loadURL('https://www.disneyplus.com/');
  }
}

function show_help(mitem, win, event){
  const message = 
  "welcome to KawaiKara.\n\
  this application is  OTT streaming Viewer\n\
  if you want to help, write your issue and question on Github Issue conner.\n\
  github repo : https://github.com/fabyday/kawaikara";
  dialog.showMessageBox(win, {message: message})
}
const menu_templete=[
  {
    label: 'OTT',
    submenu:[
      {
        label : 'netflix',
        accelerator: 'CommandOrControl+N',
        click : check_item
      },
      {
        label:'laftel',
        accelerator: 'CommandOrControl+L',
        click : check_item
      },
      {
        label:'disney',
        accelerator: 'CommandOrControl+D',
        click : check_item
      }
    ]
    
  },
  {
    label : "help",
    click : show_help
  }
  
];



let newMenu= Menu.buildFromTemplate(menu_templete);





app.disableHardwareAcceleration();
function createWindow () {
  mainWindow = new BrowserWindow(

    {
      width: 800,
      height: 600,
      // maxWidth : 800,
      // maxHeight : 600,
      plugins: true,
      autoHideMenuBar : true,
      icon: path.join(__dirname, '../resources/icons/kawaikara.ico'),

      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      }


  }
  );
  mainWindow.loadURL('https://laftel.net/');

  mainWindow.setMenu(newMenu)

  mainWindow.on('fullscreenchange', () => {
    console.log("fullscreenchange")
});


mainWindow.setFullScreenable(false)
// mainWindow.setFullScreenable(false)
// mainWindow.setMaximizable(false)
mainWindow.on('resize', function () {
  var size   = mainWindow.getSize();
  var width  = size[0];
  var height = size[1];
  console.log("width: " + width);
  console.log("height: " + height);
});
mainWindow.on('enter-html-full-screen', () => {
  console.log("enter html full screen")
  
 
})

mainWindow.on('enter-full-screen', () => {
  console.log("enter full screen")
  // e.preventDefault();
  
  // mainWindow.webContents.executeJavaScript(`addEventListener${laftel.fullscreen_video.toString()})()`);
})
mainWindow.webContents.on('did-finish-load', () => {
  console.log("didfin");
  // console.log(e);
  // console.log(s);
});
mainWindow.webContents.on('will-navigate', ()=>{
  console.log("change url");

});
};
ipcMain.on("open-url", ()=>{console.log("open url")});
ipcMain.on("fullscreen", ()=>{console.log("fullscreen")});




app.whenReady().then(async () => {
  await components.whenReady();
  console.log('components ready:', components.status());
  createWindow();
});