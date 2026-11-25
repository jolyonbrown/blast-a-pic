#!/bin/sh
# Packs just the game into a zip for uploading to itch.io (Kind of project: HTML).
# Usage: sh tools/package-itch.sh   -> dist/blast-a-pic-<version>.zip
set -e
cd "$(dirname "$0")/.."
version=$(sed -n "s/^const VERSION = '\(.*\)';/\1/p" sw.js)
out="dist/blast-a-pic-$version.zip"
mkdir -p dist
rm -f "$out"
zip -q -r -X "$out" index.html manifest.webmanifest sw.js css js icons -x '*.DS_Store'
echo "Made $out ($(du -h "$out" | cut -f1))"
