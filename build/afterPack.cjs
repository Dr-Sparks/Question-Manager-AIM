// Ad-hoc code-sign the Mac .app after electron-builder packages it.
//
// Why: macOS Squirrel (the auto-updater on Mac) refuses to install an update
// whose bundle isn't code-signed. Without an Apple Developer ID we can't do
// "real" signing — but we CAN ad-hoc sign with `codesign --sign -`.
// Ad-hoc signatures don't establish identity and don't pass Gatekeeper, but
// they ARE sufficient for Squirrel to accept the bundle and apply the update.
//
// This is a no-op on non-Mac builds.

const path = require("path");
const { execFileSync } = require("child_process");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const productFilename = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${productFilename}.app`);

  console.log(`[afterPack] Ad-hoc signing ${appPath}`);
  try {
    execFileSync(
      "codesign",
      ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath],
      { stdio: "inherit" }
    );
  } catch (err) {
    throw new Error(`Ad-hoc codesign failed: ${err.message}`);
  }

  // Verify the signature so a broken build fails the CI run, not the user.
  try {
    execFileSync(
      "codesign",
      ["--verify", "--deep", "--strict", appPath],
      { stdio: "inherit" }
    );
    console.log(`[afterPack] Signature verified.`);
  } catch (err) {
    throw new Error(`Ad-hoc signature verification failed: ${err.message}`);
  }
};
