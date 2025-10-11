#!/bin/bash

cd "$(dirname "$0")"
pnpm install --frozen-lockfile
pm2 start src/server.js --name api-server
pm2 save
echo "Setup completed successfully!"
