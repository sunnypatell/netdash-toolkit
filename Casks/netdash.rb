cask "netdash" do
  version "3.0.0"

  on_arm do
    sha256 "dfd0e39f1e6557b5ac144925bef70346bbade6c92eb161c21ac0032b03544134"
    url "https://github.com/sunnypatell/netdash-toolkit/releases/download/v#{version}/NetDash.Toolkit-#{version}-mac-arm64.dmg"
  end

  on_intel do
    sha256 "5d41dda13ad1db0bbd7158983d749f96ce72f37b7c4ffe498b40115eab0cf7bc"
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
