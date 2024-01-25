const { ipcRenderer, contextBridge, remote} = require('electron')
console.log('tes]\ preload')

ipcRenderer.on('SET_SOURCE', async (event, sourceId) => {
    try {

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 800,
            minHeight: 600,
            maxWidth: 1280,
            maxHeight : 1080, 
            cursor : false
          }
        },
        cursor : false
      })
      handleStream(stream)
    } catch (e) {
      handleError(e)
    }
  })
  
  function handleStream (stream) {
    const video = document.querySelector('video')
    video.srcObject = stream
    video.src = stream;
    // video.width = 800
    // video.height = 600
    video.onloadedmetadata = (e) => video.play()
  }
  
  function handleError (e) {
    console.log(e)
  }