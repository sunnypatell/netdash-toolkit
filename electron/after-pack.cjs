// ad-hoc sign macos builds whenever electron-builder skipped signing (no
// identity on ci runners): arm64 gets an ad-hoc signature automatically
// because apple silicon requires one, but x64 is left completely unsigned,
// which turns gatekeeper's "open anyway" path into a dead end on intel macs.
// the release workflow gates on `codesign --verify --deep --strict` for
// every packed app, so a broken seal fails the build instead of shipping.
const { execFileSync } = require("node:child_process")
const path = require("node:path")

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)

  try {
    execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
      stdio: "pipe",
    })
    return // already validly signed (real identity or electron-builder ad-hoc)
  } catch {
    console.log(`  • ad-hoc signing (no identity): ${appPath}`)
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
      stdio: "inherit",
    })
    execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], {
      stdio: "inherit",
    })
  }
}
