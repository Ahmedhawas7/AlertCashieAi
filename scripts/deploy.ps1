# Hawas Bot Deployment Script (Windows PowerShell)

Write-Host "🚀 Starting Hawas Bot deployment..." -ForegroundColor Cyan

# 1. Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# 2. Run migrations
Write-Host "🗄️ Applying database migrations..." -ForegroundColor Yellow
npx wrangler d1 migrations apply hawas-db --remote

# 3. Deploy worker
Write-Host "☁️ Deploying to Cloudflare Workers..." -ForegroundColor Yellow
npx wrangler deploy

Write-Host "✅ Deployment complete! Hawas is now live and sovereign." -ForegroundColor Green
