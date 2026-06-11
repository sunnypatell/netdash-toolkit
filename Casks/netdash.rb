cask "netdash" do
  version "3.0.1"

  on_arm do
    sha256 "c37f0394db2442d112f83c5db0929756b8fcd9c69863e416ea0f3120fb39c844"
    url "https://github.com/sunnypatell/netdash-toolkit/releases/download/v#{version}/NetDash-Toolkit-#{version}-mac-arm64.dmg"
  end

  on_intel do
    sha256 "a094da923ecc86d1f5cd0c004d8bbb3bffefa965528bb652ca1be66403cd7c32"
    url "https://github.com/sunnypatell/netdash-toolkit/releases/download/v#{version}/NetDash-Toolkit-#{version}-mac-x64.dmg"
  end

  name "NetDash Toolkit"
  desc "Professional network engineering toolkit with 40+ networking tools"
  homepage "https://github.com/sunnypatell/netdash-toolkit"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "NetDash Toolkit.app"

  caveats <<~CAVEATS
    this app is ad-hoc signed (not notarized). install with
    --no-quarantine, or clear the quarantine flag after install:
      xattr -cr "/Applications/NetDash Toolkit.app"
  CAVEATS

  zap trash: [
    "~/Library/Application Support/netdash-toolkit",
    "~/Library/Preferences/com.sunnypatell.netdash-toolkit.plist",
    "~/Library/Saved Application State/com.sunnypatell.netdash-toolkit.savedState",
  ]
end
