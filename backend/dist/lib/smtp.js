"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
/**
 * SMTP Integration — Ethereal Email
 *
 * Uses Ethereal Email (https://ethereal.email) as a test SMTP service.
 * Ethereal captures emails for preview without actually sending them.
 * If no credentials are provided, a test account is auto-created on first use.
 */
let cachedTransporter = null;
let cachedAccount = null;
async function getTestAccount() {
    if (cachedAccount)
        return cachedAccount;
    const configuredUser = process.env.SMTP_USER;
    const configuredPass = process.env.SMTP_PASS;
    if (configuredUser && configuredPass) {
        cachedAccount = { user: configuredUser, pass: configuredPass };
        return cachedAccount;
    }
    // Auto-create an Ethereal test account
    const testAccount = await nodemailer_1.default.createTestAccount();
    cachedAccount = { user: testAccount.user, pass: testAccount.pass };
    console.log(`[SMTP] Ethereal test account created: ${testAccount.user}`);
    console.log(`[SMTP] Preview emails at: https://ethereal.email`);
    return cachedAccount;
}
async function getTransporter() {
    if (cachedTransporter)
        return cachedTransporter;
    const account = await getTestAccount();
    cachedTransporter = nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false,
        auth: {
            user: account.user,
            pass: account.pass,
        },
    });
    console.log('[SMTP] Transporter initialized');
    return cachedTransporter;
}
async function sendEmail(params) {
    try {
        const transporter = await getTransporter();
        const info = await transporter.sendMail({
            from: `"${params.fromName}" <${params.from}>`,
            to: params.to,
            subject: params.subject,
            text: params.body,
            html: params.body.replace(/\n/g, '<br>'),
        });
        const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
        console.log(`[SMTP] Email sent to ${params.to} — messageId: ${info.messageId}`);
        if (previewUrl) {
            console.log(`[SMTP] Preview URL: ${previewUrl}`);
        }
        return {
            success: true,
            messageId: info.messageId,
            previewUrl: typeof previewUrl === 'string' ? previewUrl : undefined,
        };
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown SMTP error';
        console.error(`[SMTP] Failed to send to ${params.to}:`, errorMessage);
        return {
            success: false,
            error: errorMessage,
        };
    }
}
//# sourceMappingURL=smtp.js.map