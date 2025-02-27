// const observer = new MutationObserver((mutations) => {
//     if (document.querySelector("div.ytp-popup.ytp-contextmenu div.ytp-panel-menu")) {
//         console.log('video 태그가 생성되었습니다!');



// const newItem = window.document.createElement("div");
// newItem.classList.add("ytp-menuitem");
// // 아이콘 생성
// const icon = window.document.createElement("div");
// icon.classList.add("ytp-menuitem-icon");

// // 라벨(텍스트) 생성
// const label = window.document.createElement("div");
// label.classList.add("ytp-menuitem-label");
// label.textContent = "새로운 메뉴 추가"; // ✅ Trusted DOM 정책을 위반하지 않음

// // 내용 생성
// const content = window.document.createElement("div");
// content.classList.add("ytp-menuitem-content");

// // 요소 추가
// newItem.appendChild(icon);
// newItem.appendChild(label);
// newItem.appendChild(content);
// newItem.onclick=(e)=>{
//     const ctxmenu = document.querySelector("div.ytp-popup.ytp-contextmenu");
//     if (ctxmenu) {
//       ctxmenu.style.display = "none";  // 메뉴 닫기
//     }
//     // https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
//     const videoUrl = window.location.href;
//     const yotube_regex = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/
// // this regex transform this https://www.youtube.com/watch?v=7qX8_vf7Yt4&ab_channel=%EB%AA%B0%EB%9D%BC as 7qX8_vf7Yt4;
// // if you want to create youtu.be link concat it yotu.be+"/"+7qX8_vf7Yt4
//     console.log(    videoUrl.match(yotube_regex)[1]
// )
//     // 클릭 시 전파 방지 (필요한 경우)
//     e.stopPropagation();
//     console.log("FUKC!!!")
// }
// // get context panel code.
// const ctxmenu = window.document.querySelector("div.ytp-popup.ytp-contextmenu div.ytp-panel-menu")
// ctxmenu.appendChild(newItem )
//         observer.disconnect(); // 감지가 완료되면 더 이상 감지할 필요 없으므로 중단
//     }
// });

// // body 태그 아래의 모든 요소 변화를 감지
// observer.observe(document.body, { childList: true, subtree: true });