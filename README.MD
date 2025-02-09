# *KAWAIKARA*

<p align="center">
  <img src="./imgs/kawaikara_banner_title3.png" />
</p>
<p align="center">
<strong>KAWAIKARA</strong> is
<strong>OTT-Viewer</strong> based on 
<strong>Electron</strong>
</p>



 [![read in eng](https://img.shields.io/badge/README-ENGLISH-blue?style=for-the-badge&labelColor=gray)](./README.MD)
[![read in kor](https://img.shields.io/badge/README-한국어-blue?style=for-the-badge&labelColor=gray)](./README_KR.MD)
 [![read in jp](https://img.shields.io/badge/README-日本語-blue?style=for-the-badge&labelColor=gray)](./README_JP.MD)


![Windows Support](https://img.shields.io/badge/Windows-Supported-0078D4?style=flat&logo=windows)
![macOS Support](https://img.shields.io/badge/macOS-Supported-0078D4?style=flat&logo=apple)

[![](https://dcbadge.vercel.app/api/server/JJs974BX45?style=flat)](https://discord.gg/JJs974BX45)
[![GitHub release](https://img.shields.io/github/release/fabyday/kawaikara.svg?logo=github)](https://github.com/fabyday/kawaikara/releases/1.1.3)
[![GitHub downloads](https://img.shields.io/github/downloads/fabyday/kawaikara/latest/total.svg?logo=github)](https://github.com/fabyday/kawaikara/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/fabyday/kawaikara/total.svg?logo=github)](https://github.com/fabyday/kawaikara/releases)

![build](https://github.com/fabyday/kawaikara/actions/workflows/publish.yaml/badge.svg)
![build](https://github.com/fabyday/kawaikara/actions/workflows/build-dev-branch.yaml/badge.svg)

I'm enjoying Discord broadcasting with my friends. and its service fit to me very weeelll. However there are few problems. Discord acquires only single program window and many streaming services use DRM. watching OTT-streaming by Browser may be an alternative way. But Wathching By Browser waste screen area(I just want fullscreen mode but not actually fullscreen. I just want to remove address bar and scrollbar and other UIs.) That's why I decide to develop super-duper-tight&fit OTT-streaming viewer.


## Features

* ~~**adblock** for youtube~~ (**Library** was Deprecated.)
* **PiP** (Picture in Picture)
* **fullscreen** to **user fixed window**
* ~~**Chrome extension (Now Developing)**~~ (**Canceled**)
* Wathcing Chzzk with Ad Free
* Watching OTT with friends on Discord

## Available for 
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
  - **Crunchyroll**
- Music
  - **Apple music** 
- streaming
  - **Chzzk**
  - **Twitch**


## Rich Presence On Discord
<p align="center">
    <img src="imgs/discord_presence.png" width="30%" >

<p align="center">
     <Strong>Use Kawai Rich Presence on Discord</strong>
</p>
</p>

## DRM-problem

Yes, *Electron* doesn't support _CDM_ due to the Liscense. In this reason, I couldn't directly use *Electron* frameworks. To support DRM product, I used **castlab**'s electron fork.

# Examples
<p align="center">
  <a href="https://youtu.be/NOlJcX-sri8">
    <img src="https://img.youtube.com/vi/NOlJcX-sri8/0.jpg" width="90%" >
  </a>
</p>
<p align="center">
  <Strong>Laftel</Strong> streaming video examples <a href="https://youtu.be/NOlJcX-sri8"><img alt="YouTube Video Views" src="https://img.shields.io/youtube/views/NOlJcX-sri8">
</a>
</p>



<p align="center">  
<br>
  <img src="./imgs/examples.png" align="center" width="45%">  
  <img src="./imgs/example_fullscreen_model.png" align="center" width="45%">  
</p>
<p align="center">
  <Strong>Laftel</Strong> default mode(left), full screen mode(right) 
</p>

<p align="center">  
  <img src="./imgs/netflix_examples.png" align="center" width="90%">  
</p>

<p align="center">
    <Strong>Netflix</strong> Rebel Moon.
</p>

<p align="center">  
  <img src="./imgs/discord_examples1.png" align="center" width="90%">  
</p>
<p align="center">
  <Strong>discord streaming<br></Strong> (default mode)
</p>


<p align="center">  
  <img src="./imgs/discord_examples2.png" align="center" width="90%">  
</p>
<p align="center">
  <Strong>discord streaming<br></Strong> (full screen mode)
</p>



## Usage 


<p align="center">  
  <img src="./imgs/menu.png" align="center" width="60%">  
</p>
<p align="center">
  You can Use <Strong>Tab</Strong>  key to Open Menubar
<br>
</p>

1. Click ```Tab``` key to Open Menu.
2. Select service what you want.
3. Enjoying Service!

* Open Menu : ```Tab```
* Fullscreen On/Off : ```Alt+Enter```


## build your own OTT-viewer(Windows 10/11)

This is simple way. Just follow my way. you must prepare *nodejs* environment. I recommend to use *nvm*(node version manager) and *yarn*.


before starting. we need to register *castlab* that organization(company ? or not...) provides *CDM* certification.


install ```conda``` environment
sign up castlab 
```shell
conda create -n test_env python=3.10
conda activate test_env
pip install castlabs_evs

#make castlabs account
python -m castlabs_evs.account signup

#after signup. login with your computer.
python -m castlabs_evs.account reauth -A ${your_account} -P ${your password}

ok. then it's done.
```

## Make available for disord Rich presence

crete ```.env``` file in your root repository.
```
DISCORD_APP_ID=${write App ID here.}
DISCORD_PUB_KEY=${write App public key here.}
```



## Publish To your Own Repository
You must run this script on powershell.(funtion that generating certification file use powershell functions.)
```shell 
yarn install # install all deps in package.json 
yarn make-cert:win # make your self-signed-cert(offical cert is too expensive...) 
# package_local_only rename to 
yarn build # it's all done. baby.
```

## build your own OTT-viewer(MacOS)


install ```conda``` environment
sign up castlab 
```shell
conda create -n test_env python=3.10
conda activate test_env
pip install castlabs_evs

#make castlabs account
python -m castlabs_evs.account signup

#after signup. login with your computer.
python -m castlabs_evs.account reauth -A ${your_account} -P ${your password}

ok. then it's done.
```


You must run this script on powershell.(funtion that generating certification file use powershell functions.)
```shell 
yarn install # install all deps in package.json 
yarn make-cert:mac # make your self-signed-cert(offical cert is too expensive...) 
# package_local_only rename to 
yarn build # it's all done. baby.
```





