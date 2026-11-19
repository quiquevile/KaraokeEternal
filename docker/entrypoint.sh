#!/bin/sh
set -e

exec node build/server/main.js "$@"
