const { signPackage } = require('../scripts/lib/evs.cjs');

exports.default = async function afterPack(context) {
  if (process.env.KAWAIKARA_VMP_SIGN !== '1') {
    console.log('Widevine VMP signing skipped (KAWAIKARA_VMP_SIGN is not 1).');
    return;
  }
  signPackage(context.appOutDir);
};
