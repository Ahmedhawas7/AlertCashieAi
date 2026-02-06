export class MessageFormatter {
    static formatEvent(event: any) {
        const emojiStyle = {
            Announcement: '📢',
            TokenMovement: '💸',
            ContractInteraction: '⚙️',
            Security: '🛡️',
            Governance: '🗳️',
            Other: 'ℹ️'
        }[event.type as string] || '🔹';

        return `
${emojiStyle} *${event.title}*
_${event.summary}_

*Details*: ${event.details || 'N/A'}
${event.txHash ? `*TX*: [${event.txHash.slice(0, 10)}...](https://basescan.org/tx/${event.txHash})` : ''}
${event.blockNumber ? `*Block*: ${event.blockNumber}` : ''}

💡 *Action Hint*: ${event.actionHint || 'Stay tuned!'}
    `.trim();
    }

    static formatStart(isAdmin: boolean) {
        return `
👋 *Welcome to Cashie Watcher!*
I monitor CARV ecosystem events on Base.

*Features*:
- On-chain log detection
- Medium announcement alerts
- Smart Q&A (/ask)
- CARV ID Connection (/connect)

${isAdmin ? '👑 *Admin Access Enabled*' : ''}
    `.trim();
    }
}
