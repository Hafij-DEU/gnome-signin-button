#!/bin/sh
# Remove the Sign-In Button extension. Run with sudo.
set -e

UUID=signin-button@hafij-deu.github.io

if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root: sudo $0" >&2
    exit 1
fi

rm -rf "/usr/share/gnome-shell/extensions/$UUID"
rm -f /usr/share/gdm/dconf/95-signin-button
/usr/share/gdm/generate-config

echo "Removed. Also run as your user: gnome-extensions disable $UUID"
