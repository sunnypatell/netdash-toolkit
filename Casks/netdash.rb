cask "netdash" do
  version "1.0.0"

  on_arm do
    sha256 "ed29f57c7652da7813e1ee2c46c5e0975cd380f975211abe0840b0cc8b6e69c2"
    url "https://github.com/sunnypatell/netdash-toolkit/releases/download/v#{version}/NetDash.Toolkit-#{version}-mac-arm64.dmg"
  end

  on_intel do
    sha256 "67554f55ec02d13dc3a6a6985b94ec77637e3a89bb341a2a2104fdab4af68b43"
    url "https://github.com/sunnypatell/netdash-toolkit/releases/download/v#{version}/NetDash.Toolkit-#{version}-mac-x64.dmg"
  end

  name "NetDash Toolkit"
  desc "Professional network engineering toolkit with 14+ networking tools"
  homepage "https://github.com/sunnypatell/netdash-toolkit"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "NetDash Toolkit.app"

  zap trash: [
    "~/Library/Application Support/NetDash Toolkit",
    "~/Library/Preferences/com.netdash.toolkit.plist",
    "~/Library/Saved Application State/com.netdash.toolkit.savedState",
  ]
end
