const { notarize } = require('@electron/notarize')
const ARCH_MAP = {
  0: 'ia32',
  1: 'x64',
  2: 'armv7l',
  3: 'arm64',
  4: 'universal',
};

exports.default = function (context) {
  const {
    execSync
  } = require('child_process')
  // console.log(context)
  const { arch, packager } = context;
  
  const platform = packager.platform; // 'darwin', 'win32' else 
  const archname = ARCH_MAP[arch]
   if (process.platform === 'win32') {
    // VMP sign via EVS
    console.log('VMP signing start')
    execSync('python -m castlabs_evs.vmp sign-pkg ./output_dist/win-unpacked')
    console.log('VMP signing complete')
  }
  else if (process.platform === "darwin"){
    console.log("VMP signing start")
    console.log(`platform ${process.platform}, arch ${arch}`)


    if(archname === "x64"){
      execSync('python -m castlabs_evs.vmp sign-pkg ./output_dist/mac')
    }else if (archname === "arm64"){

      execSync('python -m castlabs_evs.vmp sign-pkg ./output_dist/mac-arm64')
    }
  }
  
    console.log("done signing")
}

