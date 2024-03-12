# *카와이카라(KAWAIKARA)*

<p align="center">
  <img src="./imgs/kawaikara_banner_title3.png" />
</p>

<p align="center">
<strong>카와이카라(KAWAIKARA)</strong>는
<strong>일렉트론</strong> 기반
<strong>OTT-Viewer</strong>  입니다.

</p>

[**ENG README**](./README.MD)


[![](https://dcbadge.vercel.app/api/server/JJs974BX45)](https://discord.gg/JJs974BX45)
![build](https://github.com/fabyday/kwaikara/actions/workflows/publish.yaml/badge.svg)

저는 친구들이랑 디코 방송을 하거나 보는 것을 좋아합니다. 그런데 디코방송은 몇가지 불편한 점들이 있습니다. 디코의 방송은 하나의 프로그램 창만을 캡쳐할 수 있다는 거죠. OTT를 스트리밍하는데 브라우저(**chrome**, **firefox** 등...)를 사용하는 방법도 있지만, 전체화면을 하지 않을 경우 주소창과 같은 불필요한 **UI** 스트리밍 영상의 일정한 부분을 차지할 것입니다. 체감상 이 영역은 __꽤__ 큽니다. 만일 친구들과 같이 OTT를 틀어놓으며 잡담을 하며 일을 하고 싶은 사람이 있다면 이는 보는 입장에서 많이 불편할 것입니다.
 따라서 저는 작은 디스코드 화면에 꽉차게 스트리밍할 수 있는 뷰어를 개발하였습니다.


## 주요 기능

* **유뷰트 & 유튜브 광고 제거**
* **PiP** (Picture in Picture)
* 영상 **풀스크린 모드**를 **사용자 지정화면**에 맞도록 변환

## 사용가능한 서비스들 
- OTT
  - **Netflix**
  - **Lafetel**
  - **Youtube**
  - **Disney plus**
  - **Amazonprime**
  - **Wavve**
  - **Watcha**
  - **Coupangplay**
  - **Tving**
- 음악
  - **Apple music**
- 스트리밍
  - **Chzzk**
  - **Twitch**





## DRM 문제

넵, **일렉트론**은 기본적으로 _CDM_ 을 지원하지 않습니다. **castlab**에서 제공하는 다른 **일렉트론**을 포크를 사용하여 제작되었습니다.


# 사용 예시
<p align="center">
  <a href="https://youtu.be/Pax7wnCTAE8">
    <img src="https://img.youtube.com/vi/Pax7wnCTAE8/0.jpg" width="90%" >
  </a>
</p>
<p align="center">
  <Strong>라프텔</Strong> 비디오 스트리밍 예시 <a href="https://youtu.be/Pax7wnCTAE8"><img alt="YouTube Video Views" src="https://img.shields.io/youtube/views/Pax7wnCTAE8">
</a>
</p>



<p align="center">  
<br>
  <img src="./imgs/examples.png" align="center" width="45%">  
  <img src="./imgs/example_fullscreen_model.png" align="center" width="45%">  
</p>
<p align="center">
  <Strong>라프텔</Strong> 기본모드(좌), 풀 스크린 모드(우) 
</p>

<p align="center">  
  <img src="./imgs/netflix_examples.png" align="center" width="90%">  
</p>

<p align="center">
    <Strong>넷플릭스</strong> Rebel Moon.
</p>

<p align="center">  
  <img src="./imgs/discord_examples1.png" align="center" width="90%">  
</p>
<p align="center">
  <Strong>디스코드 스트리밍<br></Strong> (기본 모드)
</p>


<p align="center">  
  <img src="./imgs/discord_examples2.png" align="center" width="90%">  
</p>
<p align="center">
  <Strong>디스코드 스트리밍<br></Strong> (풀스크린 모드)
</p>



## 사용법 

### 릴리즈(Release)에서 다운받으세요.
디스코드가 메뉴를 같이 캡쳐하기 때문에 기본적으로 메뉴는 숨겨져 있습니다. 

따라서 메뉴를 나타나게 하려면 아래의 단축키들을 활용하세요.

```메뉴 보기``` : ```alt```






## 카와이카라 뷰어 직접 빌드하기

직접 제작은 간단합니다. 일단 **nvm**(node version manager)를 설치하고 최신버전의 node를 설치해주세요. 그냥 **node.js**환경만 갖춘다면 충분합니다. 그 이후 **yarn**을 설치해주세요. 자세한 사항은
구글 검색을 통해서 알아서 하시면 됩니다. 저는 **nvm**을 사용하여 
node환경을 먼저 설정하는 것을 __강력하게__ 추천드립니다.


설치를 시작하기 전에 **castlab**의 id를 만들어야 합니다. 이것은 **electron**이 google의 drm을 풀어주는 widevine을 내장하지 않아서
그런 것이라고 합니다. 

이것은 **python** 환경을 필요로 하니, **conda**를 설치해 주도록 합니다.(miniconda로 설치를 적극 추천드립니다.)

아래의 코드를 따라 치시면 됩니다.

castlab 계정 생성하기.
```shell
# 콘다 가상 환경 설정 및 castlab 라이브러리 다운로드
conda create -n test_env python=3.10
conda activate test_env
pip install castlabs_evs

#계정 생성
python -m castlabs_evs.account signup

# 컴퓨터를 castlab에 로그인 시킵니다.
python -m castlabs_evs.account reauth -A ${your_account} -P ${your password}

# 진짜 끝!
```

powershell 에서 아래의 코드를 실행해야 합니다.
인증서를 생성하는 함수는 powershell의 기능을 사용하기 때문입니다.
다음은 실제 프로젝트 디렉토리에서 해야할 일입니다.
```shell 
yarn install # package.json의 모든 library 설치
yarn make-cert # 사설(?) 인증서 생성(진짜 인증서는 가격이 꽤 비쌉니다...) 

yarn build # 빌드 시작.

```







