const {app,desktopCapturer, BrowserWindow,dialog,screen,session, components, ipcMain, ipcRenderer, Menu, MenuItem, BrowserView, webContents} = require('electron');
const logger = require('electron-log')
// * `widevinecdm.dll` on Windows.
// app.commandLine.appendSwitch('widevine-cdm-path', 'C:\\Program Files\\Google\\Chrome\\Application\\120.0.6099.130\\WidevineCdm\\_platform_specific\\win_x64\\widevinecdm.dll')
// // The version of plugin can be got from `chrome://components` page in Chrome.
// app.commandLine.appendSwitch('widevine-cdm-version', '1.0.2738.0')
app.commandLine.appendSwitch('auto-detect', 'false');
app.commandLine.appendSwitch('no-proxy-server')
app.commandLine.appendSwitch("enable-features", "ScreenCaptureKitMac");
//preferences
const preference = require('./setting/preference')

// addblock
const {ElectronBlocker} =  require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch'); // required 'fetch'
ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
  blocker.enableBlockingInSession(session.defaultSession);
});


var pip_window = null;

const open_preference = ({}) =>{
  preference.show()
}




const path = require('node:path')
const laftel = require('./scripts/laftel')
const updater = require("./updater")
let mainWindow =null
function check_item(mitem, win, event){
  if (mitem.label == "netflix")
    mainWindow.loadURL('https://netflix.com/');
  else if(mitem.label == "laftel"){
    mainWindow.loadURL('https://laftel.net/');
  }else if(mitem.label == "disney"){
    mainWindow.loadURL('https://www.disneyplus.com/');
  }else if(mitem.label == "youtube"){
    mainWindow.loadURL('https://www.youtube.com/');
  }else if(mitem.label == "apple music"){
    mainWindow.loadURL('https://music.apple.com/kr/');
  } else if(mitem.label == "twitch"){
    mainWindow.loadURL('https://www.twitch.tv/');
  }else if(mitem.label == "youtube music"){
    mainWindow.loadURL('https://music.youtube.com/');
  }else if(mitem.label == "chzzk"){
    mainWindow.loadURL('https://chzzk.naver.com/');
  }
}



function show_help(mitem, win, event){
  const message = 
  `welcome to KawaiKara.\n\
  this application is  OTT streaming Viewer\n\
  if you want to help, write your issue and question on Github Issue conner.\n\
  github repo : https://github.com/fabyday/kawaikara\n\
  version : ${app.getVersion()}`;

  dialog.showMessageBox(win, {message: message})
}
app.setName(`${app.getName()} ${app.getVersion()}`);

var pip_mode = false;
var cur_loc = null;
function pip_event(mitem, win, event){
  pip_mode = !pip_mode
  
  const winBounds = win.getBounds();
  const whichScreen = screen.getDisplayNearestPoint({x: winBounds.x, y: winBounds.y});
  if (pip_mode){
    cur_loc = winBounds
    new_x = whichScreen.bounds.width - winBounds.width 
    new_y = 0
    console.log(new_x)
    console.log(new_y)
    
    // Returns the screen where your window is located
    console.log(winBounds)
    console.log(whichScreen)
    win.setPosition(new_x, new_y)  
    // normal, floating, torn-off-menu, modal-panel, main-menu, status, pop-up-menu, screen-saver
    win.setAlwaysOnTop(pip_mode, "main-menu")
    win.setMovable(!pip_mode)

    win.setResizable(!pip_mode)
    // win.setIgnoreMouseEvents(true)
    console.log("Testemnd1")
  }else{
    win.setAlwaysOnTop(pip_mode)
    win.setPosition(cur_loc.x, cur_loc.y)
    win.setMovable(!pip_mode)
    win.setResizable(!pip_mode)
  }
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
      },{
        label:'youtube',
        accelerator: 'CommandOrControl+Y',
        click : check_item
      },
      {
        label:'apple music',
        accelerator: 'Control+A',
        click : check_item
      },{
        label:'youtube music',
        accelerator: 'Control+A',
        click : check_item
      },{
        label:'twitch',
        accelerator: 'Control+T',
        click : check_item
      },
      {
        label:'chzzk',
        accelerator: 'Control+C',
        click : check_item
      }
    ]
    
  },
  {
    label : 'features',
    submenu:[{
      label: 'PiP(Picture in Picture)',
      accelerator: 'CommandOrControl+P',
      click : pip_event
    }
  ]
  },
  {
    label: "settings",
    submenu:[{
      label: 'preferences',
      accelerator: 'CommandOrControl+P',
      click : ()=>{preference.show()}
    },
    {
      label : 'check for update',
      click : updater.checkForUpdates
    }
  ]},
  {
    label : "help",
    click : show_help
  },
  
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
        preload: path.join(__dirname, 'preload.js'),
        backgroundThrottling :false
      }

  }
  );

  pip_window = new BrowserWindow({x:10, y:20,width:800, height : 600, 
    alwaysOnTop : true,
    // resizable : false,
    titie : "pip",
    // frame:false,
    // show:false,
    webPreferences:{    
    
         preload: path.join(__dirname, 'preload_renderer.js')
        }
        })
    // preload: "/Users/roh/myproject/hobby/2024/kawaikara/src/preload_renderer.js"}})
  
  pip_window.loadFile( "src/index.html")
  pip_window.webContents.openDevTools() 
  const func = ()=>{
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
      for (const source of sources) {
        console.log("main" , mainWindow.getMediaSourceId())
        console.log("so : " , source.id)
        if(source.id === mainWindow.getMediaSourceId()){
            pip_window.webContents.send('SET_SOURCE', source.id)
            return
        }
      }
    })}
  
mainWindow.webContents.openDevTools() 
  mainWindow.on('page-title-updated', (evt) => {
    evt.preventDefault();
  });
  

  updater.setProgressBar(mainWindow);
  
  mainWindow.loadURL('https://chzzk.naver.com/');
  mainWindow.setMenu(newMenu);


  mainWindow.on('fullscreenchange', () => {
    console.log("fullscreenchange")
});


mainWindow.setFullScreenable(false)
// mainWindow.setFullScreenable(false)
// mainWindow.setMaximizable(false)
mainWindow.on('resize', function () {
  // var size   = mainWindow.getSize();
  // var width  = size[0];
  // var height = size[1];
  // console.log("width: " + width);
  // console.log("height: " + height);
});
mainWindow.on('enter-html-full-screen', () => {
  console.log("enter html full screen")
  
 
})


mainWindow.on('hide', (e) => {
  console.log("hide")
  // e.preventDefault();
  
  // mainWindow.webContents.executeJavaScript(`addEventListener${laftel.fullscreen_video.toString()})()`);
})
mainWindow.on('blur', (e) => {
  console.log("blur")
  // e.preventDefault();
  
  // mainWindow.webContents.executeJavaScript(`addEventListener${laftel.fullscreen_video.toString()})()`);
})
mainWindow.on('show', () => {
  console.log("shoiw")
  // e.preventDefault();
  
  // mainWindow.webContents.executeJavaScript(`addEventListener${laftel.fullscreen_video.toString()})()`);
})
mainWindow.on('enter-full-screen', () => {
  console.log("enter full screen")
  // e.preventDefault();
  
  // mainWindow.webContents.executeJavaScript(`addEventListener${laftel.fullscreen_video.toString()})()`);
})

mainWindow.webContents.on('did-finish-load', () => {
  console.log("didfin");
  func();
  // console.log(e);
  // console.log(s);
});
mainWindow.webContents.on('will-navigate', ()=>{
  console.log("change url");

});
};
ipcMain.on("open-url", ()=>{console.log("open url")});
ipcMain.on("fullscreen", ()=>{console.log("fullscreen")});

var win = null;
app.whenReady().then(async () => {
  tet =await components.whenReady();
  console.log('components ready:', components.status());
  createWindow();
  logger.info("app initialized...")
  

  console.log(__dirname)
  logger.info("second app initialized...")
  



});