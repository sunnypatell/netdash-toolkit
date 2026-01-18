cask "netdash" do
  version "2.7.0"

  on_arm do
    sha256 "2f4b70dcfcc045faac1041e7f324f96c747f4616fd04e95b2db26f46ae198afb"
    url "https://github.com/sunnypatell/netdash-toolkit/releases/download/v#{version}/NetDash.Toolkit-#{version}-mac-arm64.dmg"
  end

  on_intel do
    sha256 "6ad1439a3df0728358613ac424946b4856eb0a6342c6d2b1500c08aff3dd2622"
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
