#!/bin/bash
# Hawas Bot Deployment Script (Linux/macOS)

echo "🚀 Starting Hawas Bot deployment..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Run migrations
echo "🗄️ Applying database migrations..."
npx wrangler d1 migrations apply hawas-db --remote

# 3. Deploy worker
echo "☁️ Deploying to Cloudflare Workers..."
npx wrangler deploy

echo "✅ Deployment complete! Hawas is now live and sovereign."
