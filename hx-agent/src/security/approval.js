const { supabase } = require('../memory/supabase');
const crypto = require('crypto');

// In-memory pending approvals for speed, optional DB sync
const pendingApprovals = new Map();

function createApprovalRequest(userId, action, details) {
    const token = crypto.randomBytes(3).toString('hex'); // 6 chars
    const request = {
        id: token,
        userId,
        action,
        details,
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000 * 60 * 10 // 10 mins
    };

    pendingApprovals.set(token, request);
    return token;
}

function verifyApproval(token, userId) {
    const request = pendingApprovals.get(token);

    if (!request) return { success: false, message: 'Invalid or expired token.' };
    if (request.userId !== userId) return { success: false, message: 'Unauthorized.' };
    if (Date.now() > request.expiresAt) {
        pendingApprovals.delete(token);
        return { success: false, message: 'Token expired.' };
    }

    pendingApprovals.delete(token);
    return { success: true, request };
}

module.exports = { createApprovalRequest, verifyApproval };
