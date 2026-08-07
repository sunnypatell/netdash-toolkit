// with no signing identity on ci, arm64 still gets an ad-hoc signature but x64 is left unsigned,
// which dead-ends gatekeeper's "open anyway" on intel macs. the release workflow verifies both.
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
