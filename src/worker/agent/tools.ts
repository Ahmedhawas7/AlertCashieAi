import { normalizeArabic } from '../utils';

/**
 * Standard Tool Definitions for Gemini Function Calling
 */
export const AGENT_TOOLS = [
    {
        name: "get_user_memories",
        description: "Fetch stored facts, preferences, and identity information about the user from the bot's long-term memory.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Specific keyword or topic to search for in memory."
                }
            },
            required: ["query"]
        }
    },
    {
        name: "prepare_transfer",
        description: "Initialize a financial transfer of USDC or ETH on the Base network. This will create a pending transaction for the user to confirm.",
        parameters: {
            type: "object",
            properties: {
                recipient: {
                    type: "string",
                    description: "The recipient's wallet address (0x...) or Telegram @username."
                },
                amount: {
                    type: "string",
                    description: "The amount to send as a string."
                },
                token: {
                    type: "string",
                    description: "The token symbol (USDC, ETH, etc.). Default is USDC."
                }
            },
            required: ["recipient", "amount"]
        }
    },
    {
        name: "search_web",
        description: "Search the web for real-time information, news, or data that the agent doesn't know from memory.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query."
                }
            },
            required: ["query"]
        }
    }
];
