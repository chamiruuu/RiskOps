const { execFileSync } = require('child_process');
const path = require('path');

module.exports = async function afterPackSignMac(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
      stdio: 'inherit',
    });
    // Keep gatekeeper metadata clean in local artifacts.
    execFileSync('xattr', ['-cr', appPath], { stdio: 'inherit' });
  } catch (error) {
    throw new Error(`Failed to ad-hoc sign mac app at ${appPath}: ${error.message}`);
  }
};
