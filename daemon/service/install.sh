#!/usr/bin/env bash
# Install the Mycelia daemon as an OS background service (#69).
# macOS → launchd user agent; Linux → systemd user service.
#
#   ./install.sh [MYCELIA_URL]      # install + start
#   ./install.sh --uninstall        # stop + remove
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON="$HERE/../mycelia-daemon.mjs"
NODE="$(command -v node)"
URL="${1:-${MYCELIA_URL:-http://localhost:3000}}"
OS="$(uname -s)"

fill() { sed -e "s#@NODE@#$NODE#g" -e "s#@DAEMON@#$DAEMON#g" -e "s#@URL@#$URL#g" -e "s#@HOME@#$HOME#g" "$1"; }

uninstall() {
  if [ "$OS" = "Darwin" ]; then
    launchctl unload "$HOME/Library/LaunchAgents/com.mycelia.daemon.plist" 2>/dev/null || true
    rm -f "$HOME/Library/LaunchAgents/com.mycelia.daemon.plist"
  else
    systemctl --user disable --now mycelia-daemon 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/mycelia-daemon.service"
    systemctl --user daemon-reload 2>/dev/null || true
  fi
  echo "Mycelia daemon service removed."
}

[ "${1:-}" = "--uninstall" ] && { uninstall; exit 0; }
[ -z "$NODE" ] && { echo "node not found on PATH"; exit 1; }

if [ "$OS" = "Darwin" ]; then
  DEST="$HOME/Library/LaunchAgents/com.mycelia.daemon.plist"
  mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
  fill "$HERE/com.mycelia.daemon.plist" > "$DEST"
  launchctl unload "$DEST" 2>/dev/null || true
  launchctl load "$DEST"
  echo "Installed launchd agent → $DEST (URL=$URL). Logs: ~/Library/Logs/mycelia-daemon.log"
else
  DEST="$HOME/.config/systemd/user/mycelia-daemon.service"
  mkdir -p "$HOME/.config/systemd/user"
  fill "$HERE/mycelia-daemon.service" > "$DEST"
  systemctl --user daemon-reload
  systemctl --user enable --now mycelia-daemon
  echo "Installed systemd user service → $DEST (URL=$URL). Logs: journalctl --user -u mycelia-daemon -f"
fi
