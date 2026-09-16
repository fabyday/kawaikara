const { signPackage } = require('../scripts/lib/evs.cjs');

exports.default = async function afterPack(context) {
  if (process.env.KAWAIKARA_VMP_SIGN !== '1') {
    console.log('Widevine VMP signing skipped (KAWAIKARA_VMP_SIGN is not 1).');
    return;
  }
  // Windows EXE resources and Authenticode are changed after this hook.
  // Its VMP signature must be created by afterSign, against those final bytes.
  if (context.electronPlatformName === 'win32') return;
  signPackage(context.appOutDir);
};
