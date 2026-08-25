# YouTube Electron Testbed

Kawaikara의 Provider, 쿠키 가져오기, 요청 가공과 완전히 분리된 최소 Electron
검증 앱이다. 같은 Electron/Chromium 버전에서 Google 로그인 판정이 어떤
브라우저 표면에 반응하는지 수동 비교한다. 제품 코드나 실제 Kawaikara 프로필은
사용하지 않는다.

이 테스트는 동작 원인을 분리하기 위한 용도다. 실제 로그인 판정은 Google이
변경할 수 있으므로, 통과한 모드도 영구적인 호환성을 보장하지 않는다.

## 설치

```bash
cd testbed/youtube
pnpm install
```

이 디렉터리는 자체 `package.json`, `pnpm-workspace.yaml`, lockfile을 사용한다.
Kawaikara와 동일한 castLabs Electron `40.10.6`을 설치한다.

## 비교 모드

| 명령 | 요청 UA | preload 동작 | sandbox |
| --- | --- | --- | --- |
| `pnpm start:raw` | Electron 기본값 | 진단만 | 켜짐 |
| `pnpm start:view-raw` | Electron 기본값 | 진단만, Kawaikara와 같은 WebContentsView | 켜짐 |
| `pnpm start:ua` | Electron 토큰만 제거 | 진단만 | 켜짐 |
| `pnpm start:legacy` | Electron 기본값 | 과거 방식처럼 isolated preload에서 Navigator 변경 | 꺼짐 |
| `pnpm start:legacy-combined` | Electron 토큰 제거 | isolated preload에서 Navigator 변경 | 꺼짐 |
| `pnpm start:main-world` | Electron 토큰 제거 | page main world에서 Navigator 변경 | 켜짐 |

각 모드는 `.profiles/<mode>`에 독립 프로필을 사용한다. 한 모드의 로그인 상태가
다른 모드에 전달되지 않는다.

## 확인된 smoke 기준값

Electron 40.10.6 / Chromium 144.0.7559.236에서 다음을 확인했다.

- `raw` 요청과 page world에는 테스트 앱 제품 토큰과 `Electron/40.10.6`이
  노출된다. UA Client Hints의 브랜드는 `Chromium`이고 아키텍처는 `arm`이다.
- `ua`는 요청과 `navigator.userAgent`에서 Electron 제품 토큰을 제거하지만,
  UA Client Hints 브랜드는 계속 `Chromium`이다.
- `legacy`의 직접 `Object.defineProperty(window.navigator, ...)`는 isolated
  preload world만 변경한다. `--probe-page-world` 결과에서 실제 YouTube page
  world는 raw Electron identity를 그대로 유지했다.
- `main-world`는 실제 page world의 UA와 UA Client Hints까지 변경했다.

수동 로그인 결과는 다음과 같았다.

| 모드 | 결과 | Google이 관찰하는 핵심 차이 |
| --- | --- | --- |
| `raw` | 성공 | 요청과 page world 모두 native Electron/Chromium identity |
| `view-raw` | 성공 | Kawaikara와 같은 `WebContentsView`, native identity |
| `ua` | 실패 | 요청 UA만 Chrome처럼 부분 변경 |
| `legacy` | 성공 | isolated preload만 변경되어 실제 page world는 raw |
| `legacy-combined` | 실패 | 요청 UA 변경과 isolated preload 변경의 조합 |
| `main-world` | 실패 | 실제 page world identity까지 Chrome처럼 변경 |

따라서 이 런타임에서는 Electron 표기 자체가 실패 원인이 아니다. 요청 UA 또는
page-world identity를 Chrome처럼 부분 변경해 native UA Client Hints와 불일치가
생길 때 Google의 insecure-browser 판정이 발생한다. 제품의 Google Provider에는
UA override를 적용하지 않는 것이 이 테스트의 결론이다.

따라서 preload 터미널 로그만 비교해서는 Google이 보는 값을 판단할 수 없다.
반드시 `--probe-page-world` 결과와 main-frame 요청 로그를 함께 비교해야 한다.

## 권장 검증 순서

```bash
pnpm reset
pnpm start:raw
pnpm start:view-raw
pnpm start:ua
pnpm start:legacy
pnpm start:legacy-combined
pnpm start:main-world
```

한 번에 하나만 실행하고 다음 항목을 기록한다.

1. YouTube의 로그인 버튼이 Google 계정 입력 화면으로 이동하는지
2. 계정 입력 후 `This browser or app may not be secure`가 나타나는지
3. 터미널의 `[Testbed/Request]`와 `[Testbed/Preload]` 결과

쿠키, 계정 ID, URL 쿼리는 로그에 출력하지 않는다. URL은 origin과 pathname만
남긴다.

## 추가 진단

DevTools를 같이 열려면 스크립트 뒤에 다음 인수를 붙인다.

```bash
pnpm start:raw -- --devtools
```

페이지 main world에서 보이는 값을 별도로 출력하려면 다음을 사용한다. 이 옵션은
`executeJavaScript`를 사용하므로 완전한 raw 비교에서는 기본적으로 꺼져 있다.

```bash
pnpm start:raw -- --probe-page-world
```

시작 주소도 HTTPS 범위에서 변경할 수 있다.

```bash
pnpm start:raw -- --url=https://www.youtube.com/
```

모든 테스트 프로필 삭제는 `pnpm reset`으로만 수행한다.

설치 상태와 preload 기동만 창 없이 확인하려면 `pnpm smoke`를 실행한다.
