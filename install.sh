#!/bin/sh
# Install the Sign-In Button extension system-wide and enable it on the
# GDM login screen. Run with sudo. Lock screen: also run
#   gnome-extensions enable signin-button@hafij-deu.github.io
# as your normal user, then log out and back in.
set -e

UUID=signin-button@hafij-deu.github.io
SRC=$(cd "$(dirname "$0")" && pwd)/$UUID
DEST=/usr/share/gnome-shell/extensions/$UUID
GDM_DCONF=/usr/share/gdm/dconf/95-signin-button

if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root: sudo $0" >&2
    exit 1
fi

rm -rf "$DEST"
install -d -m 755 "$DEST"
install -m 644 "$SRC/metadata.json" "$SRC/extension.js" "$SRC/stylesheet.css" "$DEST/"

# Greeter (gdm user) settings: enable the extension on the login screen.
cat > "$GDM_DCONF" <<EOF
# Added by signin-button install.sh; remove with uninstall.sh
[org/gnome/shell]
enabled-extensions=['$UUID']
EOF
chmod 644 "$GDM_DCONF"

# Recompile the greeter dconf database (gdm3 also does this on start).
/usr/share/gdm/generate-config

echo "Installed. Login screen shows the button after the next reboot or logout."
