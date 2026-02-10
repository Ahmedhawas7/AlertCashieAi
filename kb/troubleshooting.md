# Troubleshooting

If the bot is not responding correctly, check the following:

## 1. Connection
Ensure you are using the bot via its official Telegram link. If you are the owner, check if the Cloudflare Worker is active.

## 2. Transactions
If a transfer fails, it might be due to:
- **Insufficient Balance**: Ensure your smart wallet has enough USDC/ETH tokens.
- **Expiration**: Authorization sessions last 24 hours. Use `/authorize` to refresh.

## 3. Knowledge
If the bot doesn't know something, use `/kb_search` with simple keywords. If it's still missing, the owner can add it via `/kb_add`.

## 4. Reset
If you want to clear your conversation context, use `/resetcontext`.
