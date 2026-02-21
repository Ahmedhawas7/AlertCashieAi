import { ProcessingContext } from './types';

export class Logger {
    private context?: ProcessingContext;

    constructor(context?: ProcessingContext) {
        this.context = context;
    }

    info(message: string, data?: any) {
        this.log('INFO', message, data);
    }

    error(message: string, error?: any) {
        this.log('ERROR', message, { error: error?.message || error, stack: error?.stack });
    }

    debug(message: string, data?: any) {
        // In production, might want to disable debug logs or filter them
        this.log('DEBUG', message, data);
    }

    private log(level: string, message: string, data?: any) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: this.context,
            data
        };
        console.log(JSON.stringify(entry));
    }
}
