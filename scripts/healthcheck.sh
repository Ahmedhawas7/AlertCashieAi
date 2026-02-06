#!/bin/bash
# Simple healthcheck script for Docker/Deployment

STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")

if [ "$STATUS_CODE" -eq 200 ]; then
  echo "Bot is healthy"
  exit 0
else
  echo "Bot healthcheck failed"
  exit 1
fi
