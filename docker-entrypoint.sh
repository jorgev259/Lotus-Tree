#!/bin/sh
set -e

if ! ls /app/dist/config/*.json > /dev/null 2>&1; then
    echo "Seeding default config files..."
    cp -r /app/default-config/. /app/dist/config/
fi

for f in package.json; do
    if [ ! -f "/app/$f" ]; then
        echo "Seeding default $f..."
        if [ -d "/app/$f" ]; then
            rm -rf "/app/$f"
        fi
        cp "/app/default-project/$f" "/app/$f"
    fi
done

exec "$@"
0