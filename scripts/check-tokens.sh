#!/bin/sh
# Compatibility alias: canonical source imports replace source-token rewriting.
cd "$(dirname "$0")/.."
exec node scripts/check.mjs
