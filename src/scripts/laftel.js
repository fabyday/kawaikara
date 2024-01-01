const electron = require('electron');

function fullscreen_video(event){
    console.log('test')
    const video = document.getElementsByTagName('video');
    if (video == null){
            ; // do not doing
    }else{
        video = video[0];
        video.height = window.outerHeight;
        video.width = window.outerWidth;
        event.preventDefault();
    }

}



module.exports =  {
    "fullscreen_video": fullscreen_video
}