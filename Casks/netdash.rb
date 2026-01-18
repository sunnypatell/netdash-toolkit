cask "netdash" do
  version "2.7.0"

  # SHA256 hashes - update after release workflow completes
  on_arm do
    sha256 :no_check
    url "https://github.com/sunnypatell/netdash-toolkit/releases/download/v#{version}/NetDash.Toolkit-#{version}-mac-arm64.dmg"
  end

  on_intel do
    sha256 :no_check
    url "https://github.com/sunnypatell/netdash-toolkit/releases/download/v#{version}/NetDash.Toolkit-#{version}-mac-x64.dmg"
  end

  name "NetDash Toolkit"
  desc "Professional network engineering toolkit with 16+ networking tools"
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
