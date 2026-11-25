#!/bin/sh
# Builds dist/repeat-delete.xpi (an XPI is just a zip with manifest.json at its root).
set -e
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/repeat-delete.xpi
zip -r dist/repeat-delete.xpi \
  manifest.json schema.json COPYRIGHT LICENSE implementation.js background.js \
  icons/icon-32.png icons/icon-48.png icons/icon-64.png icons/icon-96.png
