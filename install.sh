#!/usr/bin/env bash
# Installs Taobao Clean: Tampermonkey (if missing) and then the userscript.
# Usage: curl -fsSL https://raw.githubusercontent.com/trongio/taobao-clean/main/install.sh | bash
#        curl -fsSL https://raw.githubusercontent.com/trongio/taobao-clean/main/install.sh | bash -s -- firefox
# Browsers: chrome (default), chromium, brave, edge, firefox
set -euo pipefail

SCRIPT_URL="https://raw.githubusercontent.com/trongio/taobao-clean/main/taobao-clean.user.js"
browser="${1:-chrome}"

case "$browser" in
  chrome)   bins=(google-chrome google-chrome-stable); profile="$HOME/.config/google-chrome"
            flatpak_id=com.google.Chrome ;;
  chromium) bins=(chromium chromium-browser); profile="$HOME/.config/chromium"
            flatpak_id=org.chromium.Chromium ;;
  brave)    bins=(brave-browser brave); profile="$HOME/.config/BraveSoftware/Brave-Browser"
            flatpak_id=com.brave.Browser ;;
  edge)     bins=(microsoft-edge microsoft-edge-stable); profile="$HOME/.config/microsoft-edge"
            flatpak_id=com.microsoft.Edge ;;
  firefox)  bins=(firefox); profile="$HOME/.mozilla/firefox"; flatpak_id=org.mozilla.firefox ;;
  *) echo "Unknown browser '$browser'. Use: chrome, chromium, brave, edge, firefox" >&2; exit 1 ;;
esac

launch=()
for b in "${bins[@]}"; do
  if command -v "$b" >/dev/null 2>&1; then launch=("$b"); break; fi
done
if [ ${#launch[@]} -eq 0 ] && command -v flatpak >/dev/null 2>&1 && flatpak info "$flatpak_id" >/dev/null 2>&1; then
  launch=(flatpak run "$flatpak_id")
fi
if [ ${#launch[@]} -eq 0 ]; then
  echo "Could not find $browser. Install it, or pass another browser, e.g. '| bash -s -- firefox'." >&2
  exit 1
fi

open_url() { nohup "${launch[@]}" "$1" >/dev/null 2>&1 & }
wait_enter() { printf '\n%s\nPress Enter when done... ' "$1"; read -r _ </dev/tty; }

case "$browser" in
  edge)    tm_id=iikmkjmpaadaobahmlepeloendndfphd
           store="https://microsoftedge.microsoft.com/addons/detail/tampermonkey/$tm_id" ;;
  firefox) tm_id=firefox@tampermonkey.net
           store="https://addons.mozilla.org/firefox/addon/tampermonkey/" ;;
  *)       tm_id=dhdgffkkebhmkfjojejmpbldmpobfkfo
           store="https://chromewebstore.google.com/detail/tampermonkey/$tm_id" ;;
esac

if [ "$browser" = firefox ]; then
  installed=$(compgen -G "$profile/*/extensions/$tm_id.xpi" || true)
else
  installed=$(compgen -G "$profile/*/Extensions/$tm_id" || true)
  # Snap Chromium keeps its profile elsewhere.
  [ -z "$installed" ] && [ "$browser" = chromium ] && installed=$(compgen -G "$HOME/snap/chromium/common/chromium/*/Extensions/$tm_id" || true)
fi

echo "Taobao Clean installer ($browser)"

if [ -z "$installed" ]; then
  echo "Step 1: install Tampermonkey (it runs the script)."
  open_url "$store"
  wait_enter "In the browser tab that opened, click 'Add to ${browser^}' / 'Get' and confirm."
  if [ "$browser" != firefox ]; then
    open_url "chrome://extensions/?id=$tm_id"
    wait_enter "On the Tampermonkey details page, turn ON 'Allow User Scripts' (or 'Developer mode' at the top right if that toggle is missing)."
  fi
else
  echo "Tampermonkey is already installed, skipping step 1."
fi

echo "Step 2: install the Taobao Clean script."
open_url "$SCRIPT_URL"
echo "In the Tampermonkey tab that opened, click 'Install'. Then open https://www.taobao.com and you're done."
