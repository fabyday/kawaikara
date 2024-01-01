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

function set_fullscreen_model(){
    addEventListener("enter-full-screen", null);
    console.log("test")
}



module.exports =  {
    "set_fullscreen_model" : set_fullscreen_model,
    "fullscreen_video": fullscreen_video
}