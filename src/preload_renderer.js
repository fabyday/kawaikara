const { ipcRenderer, contextBridge, remote} = require('electron')
console.log('tes]\ preload')

ipcRenderer.on('SET_SOURCE', async (event, sourceId) => {
    try {

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        cursor:"none",
        video: {
          cursor:"none", 
          
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            width: 800,
            // maxWidth: 400,
            height: 600,
            // maxHeight : 400, 
            cursor : false
          }
        },
        cursor : false
      })
      console.log(stream)
      stream.getVideoTracks()[0].getSettings().cursor = false;
      console.log("test")
     console.log(stream.getVideoTracks()[0].getSettings()) 
      // console.log(navigator.mediaDevices.getSupportedConstraints())
      window.stream = stream
     console.log(stream.getVideoTracks()[0].getSettings().width)
     console.log(stream.getVideoTracks()[0].getSettings().height)
     console.log(stream.getVideoTracks())
      handleStream(stream)
    } catch (e) {
      handleError(e)
    }
  })
  
  function handleStream (stream) {
    const video = document.querySelector('video')
    video.srcObject = stream
    video.width = 800
    video.height = 600
    video.cursor = false
    video.onloadedmetadata = (e) => video.play()
  }
  
  function handleError (e) {
    console.log(e)
  }