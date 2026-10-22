# 외부 앱 개발자 가이드

[English](../../../ExternalApps/README.md) · [개발자 문서](../../../README.md)

현재 `dev` 구현을 기준으로 합니다. 배포 manifest의 `schemaVersion`과 현재 연결
프로토콜 버전은 **1**을 유지합니다. 앱 자체 버전과 어댑터 `revision`은 별개입니다.

## 1. 준비할 세 가지 계약

| 계약 | 작성 주체와 역할 | 현재 지원 |
| --- | --- | --- |
| `kawaikara.manifest.json` | 외부 앱 제작자가 이름·이미지·OS별 설치 정보 제공 | 공개 HTTPS 조회, 미리보기, 검증된 다운로드 |
| Provider의 `externalApps` / `externalAppManifests` | Provider 제작자가 사용할 앱과 설치 정보 출처 선언 | Provider별 접근 제한과 설치 패널 |
| `ExternalAppAdapter` / `ExternalAppDescriptor` | Kawaikara 측 신뢰된 코드가 검색·액션·권한 구현 | 공통 등록/호출 구조와 기본 다운로더 어댑터 |

**manifest만 공개하면 임의의 앱이 자동으로 연결되는 것은 아닙니다.** 새로운 앱의
실제 연결에는 Kawaikara에 어댑터를 통합하는 작업이 필요합니다. 원격 manifest로
JavaScript를 실행하거나 권한을 얻을 수 없습니다. 범용 외부 앱 검색, Native Messaging,
원격 어댑터 로더는 아직 제공하지 않습니다. 배포 전에 어댑터 통합 범위를 협의하세요.

다운로더에 포함된 `kawaikara-companion.json`도 별도의 구체적인 연동 문서이며,
아래 공개 배포 manifest와 같은 형식이 아닙니다.

## 2. 앱 식별자

`org.example.editor`처럼 제작자가 관리하는 고유 ID를 정하고 릴리스마다 유지합니다.
manifest, Provider 선언, 어댑터의 ID가 일치해야 합니다. 소문자 패턴
`^[a-z0-9]+(?:[.-][a-z0-9-]+)+$`, 최대 160자를 사용합니다.

참조 앱은 이름 `kawai-downloader`, ID `day.faby.kawai-downloader`입니다.
실행 스킴은 `kawai-downloader`이며 ID와 동일하지 않습니다. 다른 앱에서 이 ID를
재사용하지 마세요. ID·이름·아이콘은 인증 수단이 아닙니다.

## 3. 배포 manifest 작성

[JSON Schema](../../../../../resources/schemas/external-app-distribution.schema.json)와
[공개 타입](../../../../../src/Common/ExternalAppDistribution.ts)을 기준으로 작성합니다.
아래는 macOS/Windows 설치 파일과 Linux 설치 안내를 제공하는 예시입니다.

```json
{
  "schemaVersion": 1,
  "id": "org.example.editor",
  "name": "Example Editor",
  "icon": "./icon.png",
  "homepage": "https://example.org/editor/",
  "guideUrl": "https://example.org/editor/install/",
  "connection": {
    "protocolVersion": 1,
    "transport": "loopback",
    "launchScheme": "example-editor"
  },
  "targets": [
    {
      "os": "darwin",
      "arch": "arm64",
      "version": "0.1.0",
      "artifact": {
        "url": "./ExampleEditor-arm64.dmg",
        "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "format": "dmg"
      }
    },
    {
      "os": "win32",
      "arch": "x64",
      "version": "0.1.0",
      "artifact": {
        "url": "./ExampleEditor-x64.exe",
        "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "format": "exe"
      }
    },
    {
      "os": "linux",
      "arch": "x64",
      "guideUrl": "https://example.org/editor/install/linux/"
    }
  ]
}
```

0으로 채운 두 SHA-256은 반드시 실제 최종 파일의 해시로 교체하세요. URL도 예시입니다.
macOS에서는 `shasum -a 256 file.dmg`, PowerShell에서는
`Get-FileHash .\ExampleEditor-x64.exe -Algorithm SHA256`으로 계산할 수 있습니다.

- 필수: `schemaVersion`, `id`, `name`, `targets`. 스키마 버전은 1입니다.
- OS: `darwin`, `win32`, `linux`. 아키텍처: `arm64`, `x64`, `ia32`, `arm`,
  `universal`. 현재 실행 아키텍처와 정확히 일치하는 항목이 universal보다 우선하며,
  같은 우선순위에서는 첫 항목을 선택합니다. 다른 OS 파일로 대체하지 않습니다.
- target은 `version`, `guideUrl`, `artifact`, `connection`을 추가할 수 있습니다.
  target의 connection은 공통 connection 전체를 대체합니다. target의 guideUrl은
  공통 설치 안내보다 우선합니다. 일치하는 target이 없으면 미지원입니다.
- artifact는 `url`, `sha256`, `format`이 모두 필요합니다. 형식은 `dmg`, `pkg`,
  `zip`, `exe`, `msi`, `appimage`, `deb`, `rpm`, `tar.gz`입니다.
- connection은 안내 정보입니다. `transport`는 `loopback`, 현재 참조 프로토콜은 1이며,
  이 선언만으로 연결 협상이나 실행 스킴 호출이 이루어지지 않습니다.

GitHub 이외의 공개 HTTPS 서버도 사용할 수 있습니다. 인증 없이 접근 가능해야 하며
자격 증명이 포함된 URL, 사설망, 비표준 공개 포트는 거부합니다. 리디렉션도 검사하고
사용자의 브라우저 쿠키는 전송하지 않습니다. 상대 경로는 CDN 리디렉션 이후가 아닌
**원래 manifest URL**을 기준으로 해석합니다. `latest` 주소를 사용할 때는 상대 경로가
실제 파일을 가리키는지 확인하거나 버전에 고정된 절대 URL을 사용하세요.

| 항목 | 제한 및 동작 |
| --- | --- |
| manifest | 최대 256 KiB, target 최대 64개 |
| 아이콘 | PNG/JPEG/WebP, 최대 512 KiB·2048×2048; PNG로 정규화 |
| 설치 파일 | 최대 2 GiB, SHA-256 검증 |
| 미리보기 | 출처별 최대 32개 캐시, 오프라인 캐시 표시, 작업 토큰 20분 후 만료 |

아이콘을 바꾸면 버전별 새 URL을 제공하세요. 배포 아이콘 캐시와 인증된 연결에서
받은 아이콘 캐시는 별개입니다. 이미지를 신뢰나 앱 인증의 근거로 사용하면 안 됩니다.

macOS DMG/PKG와 Windows EXE/MSI는 사용자 확인과 해시 검증 후 OS 설치 UI를 엽니다.
Kawaikara가 직접 관리자 권한을 얻거나 격리를 해제하거나 앱을 자동 등록하지 않습니다.
ZIP/Linux 형식은 검증된 다운로드와 설치 안내를 제공하며 자동 압축 해제·실행은 하지
않습니다. 해시는 파일 무결성 검증이므로 OS별 앱 서명도 별도로 준비해야 합니다.

## 4. Provider에서 앱 선언

Provider의 기존 manifest에 다음 조각을 병합합니다.

```json
{
  "descriptors": {
    "externalApps": ["org.example.editor"],
    "externalAppManifests": {
      "org.example.editor": "https://example.org/editor/kawaikara.manifest.json"
    }
  }
}
```

매핑의 ID는 `externalApps`에도 있어야 합니다. 로컬 테스트 중에도 여기는 공개 HTTPS
주소를 두고 아래 프로세스 환경변수로 대체하세요. 설치 출처는 호스트가 이 선언에서
선택하므로 실행 시 액션 핸들러가 임의 주소로 바꿀 수 없습니다.

Provider는 범위가 제한된 외부 앱 API를 통해 어댑터가 정의한 액션을 호출합니다.
공통 미디어 다운로드 명령은 없습니다. `accepted: true`는 요청 인수 성공이며 실제
다운로드 완료가 아닙니다. 설치 패널을 닫으면 요청했던 Provider의 사이트와 문맥을
유지해야 합니다.

## 5. 어댑터·권한·연결 수명

[어댑터 계약](../../../../../src/Main/Functional/ExternalApps/ExternalAppAdapter.ts),
[참조 구현](../../../../../src/Main/Functional/ExternalApps/YouTubeDownloaderAdapter.ts),
[등록 위치](../../../../../src/Main/DependencyInjection/ApplicationManagers.ts)를 참고하세요.
제품별 처리는 어댑터에 두고 `ExternalAppManager`에는 구체적인 기능을 추가하지 않습니다.

- `descriptor`: 스키마 1, ID, 이름, revision, 권한, 액션을 선언합니다.
- `discover()`: 앱을 실행하거나 비밀 정보를 읽지 않고 사용 가능 여부를 확인합니다.
- `execute(request, host)`: 액션·인자를 검증하고 `ExternalAppResult`를 반환합니다.
  앱 부재나 미지원 요청을 호스트 오류로 번지게 하지 않습니다.
- `host.getUrl(permissionId)`, `host.getCookies(permissionId)`: 현재 승인 범위를
  검사하는 API입니다. 세션 저장소를 직접 읽는 방식으로 우회하지 않습니다.

현재 리소스 권한은 `resource.url`, `cookies.read`이며 정확한 HTTPS origin을 선언합니다.
요청 URL과 Provider 프로필은 Kawaikara가 선택합니다. 앱이 임의의 쿠키 URL이나
partition을 선택할 수 없습니다.

등록 시 권한 승인이 필요하며 일부 거부 시 해당 기능만 사용할 수 없도록 설계합니다.
참조 `open` 액션은 `source` URL 권한만 필수이고 `session` 쿠키 권한은 선택입니다.
Provider별 앱 사용 여부와 쿠키의 매번 확인/항상 허용/거부는 설정에서 변경할 수 있습니다.
취소·거부·시간 초과·권한 철회도 정상적인 결과로 처리하세요. revision·액션·권한 범위
변경으로 다시 동의를 받아야 할 수 있습니다.

쿠키·토큰·연결 자격 증명을 로그, deep link, manifest, 검색 기록, Renderer 메시지에
넣지 마세요. 인증된 요청별 통신으로 전달합니다. 권한 철회는 이후 접근을 차단하지만
이미 전달한 데이터를 회수하지는 못합니다.

참조 개발 연결은 비공개 연결 상태와 연결별 해제 기록을 영속화합니다. 상대가 종료된
상태에서 해제한 뒤 자신도 종료하더라도, 상대가 재시작하면 해제 사실을 반영해야 합니다.
명시적으로 해제한 연결을 자동 검색으로 재등록하지 않습니다. 이 개발 검색은 현재
지원되는 참조 앱을 대상으로 하며 임의의 제3자 앱 등록 API가 아닙니다.
[아키텍처 문서](../Architecture/8.ExternalApps.md)의 제안 부분을 이미 구현된 SDK로
해석하지 마세요.

## 6. 로컬 테스트

Kawaikara 저장소에서 테스트 파일과 생성된 manifest를 서빙합니다.

```sh
# Kawaikara checkout, terminal 1
pnpm external-app:serve --artifact /absolute/path/ExampleEditor-arm64.dmg --icon /absolute/path/icon.png --id org.example.editor --name 'Example Editor' --os darwin --arch arm64 --port 8765

# Kawaikara checkout, terminal 2 (macOS/Linux shell)
KAWAIKARA_EXTERNAL_APP_TEST_MANIFEST='org.example.editor=http://127.0.0.1:8765/kawaikara.manifest.json' KAWAIKARA_EXTERNAL_APP_MODE=installed pnpm dev
```

서버는 선택한 파일·아이콘·manifest만 `127.0.0.1`에서 제공하며 Ctrl+C로 종료합니다.
파일을 다시 빌드했으면 서버도 재시작해서 해시를 갱신하세요. 테스트 프로세스에서
해당 앱을 사용하는 Provider의 액션을 실행하면 선언된 ID에 따라 로컬 manifest가
선택됩니다. 설정의 독립적인 manifest 설치 입력란은 제거했습니다. 실제 연결과
Provider 호출에는 통합된 어댑터가 필요합니다.

환경변수는 `앱ID=URL`입니다. 지정한 HTTP 루프백 출처만 예외로 허용합니다.
`localhost` 대신 정확히 `127.0.0.1`과 1024–65535 포트를 사용하세요. 다른 호스트 검사,
해시 검증, 권한 확인은 그대로입니다. 환경변수 변경 전 실행 중인 Kawaikara를 종료하세요.

참조 다운로더는 다음 단축 명령을 제공합니다.

```sh
# 다운로더 저장소: 설치 파일 빌드 후 서버 실행
pnpm dev:server:build
# 이미 파일이 있으면 pnpm dev:server

# 별도 터미널의 Kawaikara 저장소
pnpm dev:external:install-test
```

기존 파일은 `pnpm dev:server --artifact /absolute/path/app.dmg --os darwin --arch arm64`로
지정할 수 있습니다. `--port`를 바꾸면 Kawaikara의 환경변수 주소도 바꾸세요.
`dev:server`는 배포 HTTP 서버이고 다운로더의 `pnpm start`는 개발 앱 실행입니다.

| Kawaikara | 외부 앱 | 테스트 방법 |
| --- | --- | --- |
| 설치본 | 설치본 | installed 연결, 필요하면 실행 파일에 로컬 manifest 환경변수 전달 |
| 개발본 | 설치본 | `pnpm dev:external:installed` 또는 fixture용 `pnpm dev:external:install-test` |
| 개발본 | 개발본 | Kawaikara에서 `pnpm dev:external:development`, 참조 다운로더에서 `pnpm start` 후 연결·권한 승인 |
| 설치본 | 개발 연결 | 현재 모드 정책에서 미지원 |

macOS 설치본은 `KAWAIKARA_EXTERNAL_APP_TEST_MANIFEST`를 설정하고
`/Applications/Kawaikara.app/Contents/MacOS/Kawaikara` 실행 파일을 직접 실행합니다.
설치 채널에 맞게 경로를 바꾸세요. 테스트 manifest는 배포 정보만 바꿉니다. 설치본은
installed 연결을 사용하며, 개발 연결이 실패했다고 설치 앱을 대신 실행하지 않습니다.

## 수동 연결과 검색

설정 → 외부 앱 → **수동 연결**은 파일 선택 창을 엽니다. macOS `.app`, Windows
`.exe`, Linux 실행 파일을 선택하면 셸 인자 없이 실행합니다. 실행 성공이 연결 성공은
아닙니다. 호환 앱이 인증된 연결을 요청하고 기존 권한 승인을 거쳐야 합니다.
개발 연결에서는 **실행 중인 앱**으로 기존 상대를 선택할 수도 있습니다.

현재 개발 검색은 이미 `<Kawaikara checkout>/tmp/development-connections`의 사용자별 비공개
파일을 사용합니다. 파일은 상대 검색용이고 실제 인증·통신은 loopback이 담당합니다.
자동 연결은 앱 설치 기능이 아닙니다. 임의의 제3자 설치 앱을 위한 범용 공유 파일
계약은 아직 구현되지 않았습니다. 상대 앱 데이터 디렉터리에 임의로 쓰거나 검색
파일 자체를 신원 증명으로 취급하지 마세요. 연결 해제 기록은 임시 검색 파일과
분리해서 영속적으로 유지합니다.

## 7. 배포 전 확인

1. OS/아키텍처별 파일을 빌드·서명한 뒤 최종 업로드 파일의 해시를 계산합니다.
   미지원 OS는 안내만 제공하거나 target을 생략합니다.
2. 파일·아이콘을 먼저 올리고 이를 가리키는 manifest를 공개합니다. 로그인 없이 모든
   URL에 접근 가능한지 확인합니다. GitHub Draft는 공개 배포 출처가 아니므로 공개 전에는
   로컬 서버로 테스트하세요.
3. 신규 설치, 기존 설치, 상대 실행/종료, 쿠키 거부, 취소, 오프라인 재시작, 양방향 연결
   해제를 확인합니다.
4. ID 불일치, 해시 불일치, 아이콘/manifest 접근 실패, 미지원 OS, 미리보기 만료에도
   앱이 정상적으로 동작하고 오류 상태가 표시되는지 확인합니다.
5. 앱 ID를 유지하고 앱 버전·해시를 갱신합니다. 출시 전 빌드 변경만으로 스키마나
   프로토콜 버전을 올리지 않습니다.

참조 다운로더 릴리스 도구는 manifest와 아이콘을 생성합니다. 동일 버전 Draft 교체 시
새 파일 업로드·검증 후 이전 Draft를 정리하며, 로컬 빌드만으로 공개하지 않습니다.
다른 제작자는 동일 데이터 계약을 제공하는 원하는 CI·호스팅을 사용할 수 있습니다.


## 외부 앱 테스트의 빌드 경계

`__KAWAIKARA_EXTERNAL_APP_TESTING__`은 Webpack 빌드 상수입니다. Stable에서는 false,
Staging/Nightly에서는 true입니다. Stable 번들은 개발 연결 생성 코드·검색/상태 경로와
`KAWAIKARA_EXTERNAL_APP_TEST_MANIFEST` 로더를 제외합니다. 실행 시 환경변수를 바꿔도
Stable에서 테스트 기능을 다시 켤 수 없습니다. 위 로컬 서버 테스트는 설치본을 포함해
Staging/Nightly 호스트로 진행하세요. 설치본의 통신 모드는 여전히 installed입니다.

- 정식 연결용 공용 경로: `<OS user-data root>/Kawaikara/connections/v1` — 예약된 경로이며 범용 설치 앱
  파일 검색은 아직 연결하지 않았습니다.
- 개발·테스트 검색 경로: `<Kawaikara checkout>/tmp/development-connections` — 개발 다운로더 실행 시 호스트 저장소를 지정합니다.

경로 조회만으로 폴더를 만들지 않습니다. 실행 상태 기록은 통신 계층이 소유하고,
승인·연결 상태는 각 호스트 프로필에 보관합니다. 기존 기록을 이동·삭제하거나 정식과
테스트 모드 사이에서 공유하지 않습니다.


### 저장소별 개발 연결 실행 (Windows·macOS·Linux)

개발 검색 경로는 `<Kawaikara 저장소>/tmp/development-connections`입니다.
호스트의 빌드 경로에서 결정하며 Stable에는 경로와 테스트 코드가 포함되지 않습니다.
여러 checkout은 서로 다른 검색 폴더를 사용합니다. 이전 홈 폴더 기록을 자동 이동하거나
삭제하지 않습니다. 새 위치에서는 연결 승인이 다시 필요할 수 있습니다.

Kawaikara 저장소에서 `pnpm dev:external:development`, 다운로더 저장소에서
`pnpm start:connected --kawaikara "Kawaikara 저장소의 절대 경로"`를 실행합니다.
이는 위의 일반 `pnpm start` 개발 연결 예시를 대체합니다. 따옴표로 감싸면 공백이 있는
경로도 전달할 수 있고, Windows PowerShell에서도 같은 명령을 사용합니다.
단순 `pnpm start`는 다운로더만 실행하며 연결 폴더가 설정되지 않았으면 개발 검색을
시작하지 않습니다. 별도 테스트 환경은 양쪽 프로세스에 절대 경로의
`KAWAIKARA_EXTERNAL_APP_CONNECTION_DIRECTORY`를 동일하게 설정할 수 있습니다.

정식용 예약 경로는 Windows `%LOCALAPPDATA%\Kawaikara\connections\v1`,
macOS `~/Library/Application Support/Kawaikara/connections/v1`, Linux
`${XDG_STATE_HOME:-~/.local/state}/kawaikara/connections/v1`입니다. Linux의 상대
XDG 경로는 사용하지 않으며 기본 경로로 돌아갑니다. 이 정식 폴더를 이용하는 범용
설치 앱 검색은 아직 구현 전입니다.


`dev:external:local` (alias: `dev:external:install-test`) tests distribution:
fetch the local manifest on port 8765, download/install its artifact and use installed
transport. This is separate from `dev:external:development`, which pairs running
development apps. Distribution controls remain available independently of the
connection transport when the Provider declares a manifest.

### 격리 설치 테스트

저장소의 임시 공간을 세 용도로 분리합니다.

```text
tmp/
  kawaikara Dev/                 # 기존 호스트 설정·로그·권한
  development-connections/     # 개발 연결 검색·해제 동기화
  ExternalAppTest/
    day.faby.kawai-downloader/
      cache/                    # 테스트 Manifest·아이콘 캐시
      downloads/                # 검증된 배포 파일·임시 압축 해제
      installed/                # 테스트 설치본
```

다운로더 저장소에서 `pnpm dev:server`로 배포 서버를 실행한 뒤, Kawaikara에서
`pnpm dev:external:install-test`를 실행합니다. 이 명령은 로컬 Manifest URL과
`KAWAIKARA_EXTERNAL_APP_INSTALL_TEST=1`을 함께 지정합니다.
설치 여부는 `installed/`만 확인하며 Spotlight, Applications, 환경변수로 지정한
앱 경로, OS 프로토콜 등록으로 대체하지 않습니다.
`pnpm dev:external:installed`는 기존 OS 설치 감지를 그대로 사용합니다.

macOS DMG를 테스트 설치 위치에 복사하며 격리 속성을 제거하지 않습니다.
복사 설치 모듈은 ZIP도 검증할 수 있습니다. Windows EXE/MSI와 Linux 시스템
설치기는 일반적인 방법으로 설치 위치를 보장할 수 없어 격리 자동 설치를
거부합니다. 실제 시스템 설치기로 대체 실행하지 않습니다. 다운로드 전용
배포 파일은 `downloads/` 안에 저장합니다.

재설치 테스트는 다운로더를 종료한 뒤 해당 앱의 `installed/`만 삭제하고
설정 패널에서 다시 확인하면 됩니다. 배포 캐시까지 초기화하려면 앱 ID 폴더를
삭제합니다. 등록·권한은 호스트 데이터에 별도로 남으므로 최초 승인부터 시험할
때는 등록도 별도로 해제합니다. 패키징된 다운로더의 사용자 데이터와 단일
인스턴스 공간은 정식 앱과 공유되므로 실행 테스트 전에 정식 다운로더를 종료하세요.

이전 `kawaikara Dev/development-connections` 파일은 삭제하지 않고 더 이상 읽지
않습니다. 두 개발 앱을 재시작하고 다운로더의 `start:connected`를 사용하면 새
경로에 연결됩니다. Stable 번들에는 설치 테스트 모듈·경로·환경변수 분기가
포함되지 않습니다.
