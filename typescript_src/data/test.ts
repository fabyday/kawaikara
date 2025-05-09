// (() => {
//     const e = 'undefined' == typeof unsafeWindow ? window : unsafeWindow;
//     let t;
//     document.addEventListener('click', (e) => {
//         e.target.closest('.enter') &&
//             (t = document.querySelector('#pwd').value);
//         const o = document.querySelector('video'),
//             n = document.getElementById('delay_check'),
//             a = n.cloneNode(!0);
//         n.replaceWith(a),
//             a.addEventListener('click', function (e) {
//                 e.stopImmediatePropagation(),
//                     (o.playbackRate = this.checked ? 2 : 1);
//             }),
//             (o.playbackRate = a.checked ? 2 : 1);
//     }),
//         setInterval(() => {
//             (document.querySelector('.buffering').style.display = 'none'),
//                 document
//                     .getElementById('player')
//                     .classList.remove('buffering_state'),
//                 document
//                     .getElementById('player')
//                     .classList.remove('ctrl_output');
//         }, 1e3),
//         (e.Object.defineProperty = new Proxy(e.Object.defineProperty, {
//             apply: (o, n, a) => (
//                 'WARNING_shouldConnectToAgentForHighQuality' === a[1]
//                     ? (a[2] = {
//                           value: () => !1,
//                           writable: !1,
//                           enumerable: !0,
//                           configurable: !0,
//                       })
//                     : 'WARNING_gal' === a[1] &&
//                       (a[2] = {
//                           value: async () => {
//                               const [o, n] = e.location.href
//                                   .split('/')
//                                   .slice(3, 5);
//                               return {
//                                   CHANNEL: {
//                                       RESULT: 1,
//                                       AID: await new Promise((e) =>
//                                           GM_xmlhttpRequest({
//                                               anonymous: !1,
//                                               url: 'https://api.m.sooplive.co.kr/broad/a/watch',
//                                               method: 'POST',
//                                               headers: {
//                                                   'Content-Type':
//                                                       'application/x-www-form-urlencoded',
//                                                   'User-Agent':
//                                                       'kr.co.nowcom.mobile.afreeca/8.6.0 (Android 9;) Sooplive API/8.6.0; store/P;',
//                                               },
//                                               data: `broad_no=${n}&bj_id=${o}&password=${t || ''}&confirm_adult=1`,
//                                               responseType: 'json',
//                                               onload: (t) =>
//                                                   e(
//                                                       t.response.data
//                                                           .chromecast_authentication_key,
//                                                   ),
//                                           }),
//                                       ),
//                                   },
//                               };
//                           },
//                           writable: !1,
//                           enumerable: !0,
//                           configurable: !0,
//                       }),
//                 Reflect.apply(o, n, a)
//             ),
//         }));
// })();
