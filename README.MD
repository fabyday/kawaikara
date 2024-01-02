# *KAWAIKARA*

<p align="center">
  <img src="./imgs/kawaikara_banner_title3.png" />
</p>

<p align="center">
<strong>KAWAIKARA</strong> is
<strong>OTT-Viewer</strong> based on 
<strong>Electron</strong>
</p>


[![](https://dcbadge.vercel.app/api/server/JJs974BX45)](https://discord.gg/JJs974BX45)

I'm enjoying Discord broadcasting with my friends. and its service fit to me very weeelll. However there are few problems. Discord acquires only single program window and many streaming services use DRM. watching OTT-streaming by Browser may be an alternative way. But Wathching By Browser waste screen area(I just want fullscreen mode but not actually fullscreen. I just want to remove address bar and scrollbar and other UIs.) That's why I decide to develop super-duper-tight&fit OTT-streaming viewer.



#### *Available* for 

* **Laftel**
* **Netflix**
* **Disney Plus**

....other OTT-services is completely works. but, I didn't add it due to UI problem.


## DRM-problem

Yes, *Electron* doesn't support _CDM_ due to the Liscense. In this reason, I couldn't directly use *Electron* frameworks. To support DRM product, I used **castlab**'s electron fork.

# Examples
<p align="center">
  <a href="https://youtu.be/Pax7wnCTAE8">
    <img src="https://img.youtube.com/vi/Pax7wnCTAE8/0.jpg" width="90%" >
  </a>
</p>
<p align="center">
  <Strong>Laftel</Strong> streaming video examples <a href="https://youtu.be/Pax7wnCTAE8"><img alt="YouTube Video Views" src="https://img.shields.io/youtube/views/Pax7wnCTAE8">
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

*show menu* : ```alt```

*netflix* : ```ctrl+N```

*laftel* : ```ctrl+L```

*disney* : ```ctrl+D```




## build your own OTT-viewer

This is simple way. Just follow my way. you must prepare *nodejs* environment. I recommend to use *nvm*(node version manager) and *yarn*.


before starting. we need to register *castlab* that organization(company ? or not...) provides *CDM* certification.


```shell 
yarn install # install all deps in package.json 
yarn make-cert # make your self-signed-cert(offical cert is too expensive...)
yarn build # it's all done. baby.

```







