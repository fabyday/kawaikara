# *KAWAIKARA*

<p align="center">
  <img src="./imgs/kawaikara_banner_title3.png" />
</p>

<p align="center">
<strong>KAWAIKARA</strong> is
<strong>OTT-Viewer</strong> based on 
<strong>Electron</strong>
</p>

[**GO!GO! 한국어 README**](./README_KR.MD)


[![](https://dcbadge.vercel.app/api/server/JJs974BX45)](https://discord.gg/JJs974BX45)
![build](https://github.com/fabyday/kwaikara/actions/workflows/publish.yaml/badge.svg)

I'm enjoying Discord broadcasting with my friends. and its service fit to me very weeelll. However there are few problems. Discord acquires only single program window and many streaming services use DRM. watching OTT-streaming by Browser may be an alternative way. But Wathching By Browser waste screen area(I just want fullscreen mode but not actually fullscreen. I just want to remove address bar and scrollbar and other UIs.) That's why I decide to develop super-duper-tight&fit OTT-streaming viewer.


## Features

* **adblock** for youtube
* **PiP** (Picture in Picture)
* **fullscreen** to **user fixed window**
* **Chrome extension (Now Developing)**

## available for 
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
- Music
  - **Apple music** (Connection Issue Exists)
- streaming
  - **Chzzk**
  - **Twitch**



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

### download from release.

You can Use ```alt``` key to see Menubar



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


You must run this script on powershell.(funtion that generating certification file use powershell functions.)
```shell 
yarn install # install all deps in package.json 
yarn make-cert:win # make your self-signed-cert(offical cert is too expensive...) 
# package_local_only rename to 
yarn build # it's all done. baby.

```

## build your own OTT-viewer(MacOS)

This guide is written for the zsh terminal.

Install Homebrew
```shell
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Install Miniconda, Yarn, and Node.js
```shell
brew install --cask miniconda
brew install yarn
brew install node@18

# Set up Node.js environment
echo 'export PATH="opt/homebrew/opt/node@18/bin:$PATH"' >> ~/.zshrc
echo 'export LDFLAGS="-L/opt/homebrew/opt/node@18/lib"' >> ~/.zshrc
echo 'export CPPFLAGS="-I/opt/homebrew/opt/node@18/inclue"' >> ~/.zshrc

# Apply environment variables
source ~/.zshrc
```

install ```conda``` environment
sign up castlab 
```shell
conda create -n test_env python=3.10

# Activate Conda environment
source ~/.bash_profile

conda init
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





