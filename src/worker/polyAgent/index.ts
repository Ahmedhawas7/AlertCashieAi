import { Env } from '../types';
import { PolyDB } from './db';
import { PolyClient } from './client';
import { PolyScanner } from './scanner';
import { PolyRisk } from './risk';

export class PolyAgent {
    db: PolyDB;
    client: PolyClient;
    scanner: PolyScanner;
    risk: PolyRisk;

    constructor(private env: Env) {
        this.db = new PolyDB(env.DB);
        this.client = new PolyClient(env);
        this.scanner = new PolyScanner(this.client, this.db, env);
        this.risk = new PolyRisk(this.db);
    }

    // Helper to generate OTP for manual confirmation
    generateOtp(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
}
