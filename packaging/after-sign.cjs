const { signPackage, verifyPackage } = require('../scripts/lib/evs.cjs');

exports.default = async function afterSign(context) {
  if (process.env.KAWAIKARA_VMP_SIGN !== '1') return;
  // macOS requires VMP before code signing; Windows requires the reverse.
  // Never modify the already code-signed macOS package here.
  if (context.electronPlatformName === 'win32') signPackage(context.appOutDir);
  verifyPackage(context.appOutDir);
};
