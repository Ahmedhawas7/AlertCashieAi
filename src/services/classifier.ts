export enum EventType {
    Cashie = 'Cashie',
    Campaign = 'Campaign',
    Airdrop = 'Airdrop',
    Node = 'Node',
    Staking = 'Staking',
    ID = 'ID',
    TokenMovement = 'TokenMovement',
    ContractChange = 'ContractChange',
    DevUpdate = 'DevUpdate',
    DocsUpdate = 'DocsUpdate',
    Security = 'Security',
    Other = 'Other'
}

export class EventClassifier {
    static classify(title: string, content: string): EventType {
        const t = title.toLowerCase();
        const c = content.toLowerCase();

        // Security first
        if (t.includes('upgrade') || t.includes('admin') || t.includes('proxy') || t.includes('security') || t.includes('vulnerability') || t.includes('ownership')) return EventType.Security;

        // Specific Keywords
        if (t.includes('whale') || t.includes('transfer') || t.includes('mint') || t.includes('burn')) return EventType.TokenMovement;
        if (t.includes('airdrop') || t.includes('vecarv')) return EventType.Airdrop;
        if (t.includes('node') || t.includes('verifier')) return EventType.Node;
        if (t.includes('staking') || t.includes('stake') || t.includes('lock')) return EventType.Staking;
        if (t.includes('sbt') || t.includes('carv id') || t.includes('identity')) return EventType.ID;
        if (t.includes('campaign') || t.includes('snapshot') || t.includes('season') || t.includes('whitelist')) return EventType.Campaign;
        if (t.includes('cashie') || t.includes('x402')) return EventType.Cashie;

        // Dev/Docs
        if (t.includes('release') || t.includes('commit') || t.includes('push') || t.includes('build')) return EventType.DevUpdate;
        if (t.includes('docs') || t.includes('documentation') || t.includes('guide')) return EventType.DocsUpdate;

        // Generic changes
        if (t.includes('contract') || t.includes('interact') || t.includes('call')) return EventType.ContractChange;

        return EventType.Other;
    }

    static getEmoji(type: EventType): string {
        switch (type) {
            case EventType.Cashie: return '😸';
            case EventType.Campaign: return '🎉';
            case EventType.Airdrop: return '🪂';
            case EventType.Node: return '🖥️';
            case EventType.Staking: return '🔒';
            case EventType.ID: return '🆔';
            case EventType.TokenMovement: return '💰';
            case EventType.ContractChange: return '⚙️';
            case EventType.DevUpdate: return '🔨';
            case EventType.DocsUpdate: return '📖';
            case EventType.Security: return '🛡️';
            default: return '🔹';
        }
    }
}
