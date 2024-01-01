# *KAWAIKARA*

<p align="center">
  <img src="./imgs/kawaikara.jpg" />
</p>

<p align="center">
<strong>KAWAIKARA</strong> is
<strong>OTT-Viewer</strong> based on 
<strong>Electron</strong>

</p>




Available for 

* **Laftel**

....other OTT-services is completely works. but, I didn't add it due to UI problem.


## DRM-problem

Yes, *Electron* doesn't support _CDM_ due to the Liscense. In this reason, I couldn't directly use *Electron* frameworks. electron support 


# Examples
<p align="center">  
<img src="./imgs/examples.png" align="center" width="45%">  
<img src="./imgs/example_fullscreen_model.png" align="center" width="45%">  
<figcaption align="center">
default mode(left), full screen mode(right)
</figcaption>
</p>

## build your own OTT-viewer

This is simple way. Just follow my way. you must prepare *nodejs* environment. I recommend to use *nvm*(node version manager) and *yarn*.


before starting. we need to register *castlab* that organization(company ? or not...) provides *CDM* certification.


```shell 
yarn install # install all deps in package.json 
yarn make-cert # make your self-signed-cert(offical cert is too expensive...)
yarn build # it's all done. baby.

```








