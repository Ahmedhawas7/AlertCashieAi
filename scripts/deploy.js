#!/usr/bin/env node

/**
 * Automated Deployment Script for Hawas Worker
 * 
 * This script automates the deployment process including:
 * - D1 database creation
 * - Migration application
 * - Worker deployment
 * - Webhook setup
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function exec(command, options = {}) {
    console.log(`\n▶ Running: ${command}`);
    try {
        const output = execSync(command, {
            encoding: 'utf8',
            stdio: 'inherit',
            ...options
        });
        return output;
    } catch (error) {
        console.error(`✖ Command failed: ${error.message}`);
        throw error;
    }
}

async function main() {
    console.log('🚀 Hawas Worker Deployment Script\n');
    console.log('This script will guide you through deploying your Worker to Cloudflare.\n');

    // Step 1: Check if wrangler is installed
    console.log('📦 Step 1: Checking Wrangler installation...');
    try {
        exec('npx wrangler --version');
        console.log('✓ Wrangler is installed');
    } catch {
        console.log('✖ Wrangler not found. Installing...');
        exec('npm install --save-dev wrangler');
    }

    // Step 2: Check if D1 database exists
    console.log('\n📊 Step 2: Checking D1 database...');
    const createDb = await question('Do you need to create a new D1 database? (y/n): ');

    if (createDb.toLowerCase() === 'y') {
        console.log('Creating D1 database...');
        exec('npx wrangler d1 create hawas-db');
        console.log('\n⚠️  IMPORTANT: Copy the database_id from above and update wrangler.toml');
        await question('Press Enter after updating wrangler.toml...');
    }

    // Step 3: Apply migrations
    console.log('\n🔄 Step 3: Applying D1 migrations...');
    const applyMigrations = await question('Apply migrations to remote D1? (y/n): ');

    if (applyMigrations.toLowerCase() === 'y') {
        exec('npx wrangler d1 migrations apply hawas-db --remote');
        console.log('✓ Migrations applied');
    }

    // Step 4: Set secrets
    console.log('\n🔐 Step 4: Setting secrets...');
    const setSecrets = await question('Do you need to set secrets? (y/n): ');

    if (setSecrets.toLowerCase() === 'y') {
        console.log('\nYou will need to set the following secrets:');
        console.log('- BOT_TOKEN');
        console.log('- CARV_CLIENT_ID');
        console.log('- CARV_CLIENT_SECRET');
        console.log('- ENCRYPTION_SECRET');
        console.log('- SUPABASE_URL');
        console.log('- SUPABASE_KEY');
        console.log('\nRun these commands manually:');
        console.log('npx wrangler secret put BOT_TOKEN');
        console.log('npx wrangler secret put CARV_CLIENT_ID');
        console.log('npx wrangler secret put CARV_CLIENT_SECRET');
        console.log('npx wrangler secret put ENCRYPTION_SECRET');
        console.log('npx wrangler secret put SUPABASE_URL');
        console.log('npx wrangler secret put SUPABASE_KEY');
        await question('\nPress Enter after setting all secrets...');
    }

    // Step 5: Deploy
    console.log('\n🚀 Step 5: Deploying Worker...');
    const deploy = await question('Deploy to Cloudflare Workers? (y/n): ');

    if (deploy.toLowerCase() === 'y') {
        exec('npx wrangler deploy');
        console.log('\n✓ Worker deployed successfully!');
        console.log('\n⚠️  IMPORTANT: Copy the worker URL from above');
        const workerUrl = await question('Enter your worker URL: ');

        console.log(`\n📝 Update wrangler.toml with:`);
        console.log(`CARV_REDIRECT_URL = "${workerUrl}/auth/carv/callback"`);
        console.log('\nAlso update this URL in CARV Developer Portal');

        const redeploy = await question('\nRedeploy after updating? (y/n): ');
        if (redeploy.toLowerCase() === 'y') {
            exec('npx wrangler deploy');
        }
    }

    // Step 6: Set webhook
    console.log('\n🔗 Step 6: Setting Telegram webhook...');
    const setWebhook = await question('Set Telegram webhook? (y/n): ');

    if (setWebhook.toLowerCase() === 'y') {
        const botToken = await question('Enter your BOT_TOKEN: ');
        const workerUrl = await question('Enter your worker URL: ');

        const webhookUrl = `${workerUrl}/telegram`;
        const curlCmd = `curl -X POST "https://api.telegram.org/bot${botToken}/setWebhook" -H "Content-Type: application/json" -d "{\\"url\\": \\"${webhookUrl}\\"}"`;

        exec(curlCmd);
        console.log('✓ Webhook set');
    }

    console.log('\n✅ Deployment complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Test /start command in Telegram');
    console.log('2. Test /connect command to link CARV ID');
    console.log('3. Test /whoami to verify connection');
    console.log('4. Test /status to check agent status');

    rl.close();
}

main().catch(error => {
    console.error('\n✖ Deployment failed:', error.message);
    process.exit(1);
});
