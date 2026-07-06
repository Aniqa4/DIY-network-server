import nodemailer, { type Transporter } from 'nodemailer';
import env from '../config/env';

const smtpConfigured =
  env.email.host && env.email.host !== 'replace-me' && env.email.user;

const transporter: Transporter | null = smtpConfigured
  ? nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.secure,
      auth: { user: env.email.user, pass: env.email.pass },
    })
  : null;

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${env.appUrl}/api/v1/auth/verify-email?token=${token}`;

  if (!transporter) {
    // No SMTP configured (dev) — print the link so the account can still
    // be verified by opening it in a browser.
    console.log(`[email] SMTP not configured. Verification link for ${to}:`);
    console.log(`[email]   ${link}`);
    return;
  }

  await transporter.sendMail({
    from: env.email.from,
    to,
    subject: 'Verify your email — DIY Tutorials',
    html: `
      <p>Welcome to DIY Tutorials! Click the link below to verify your email address:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
  console.log(`[email] Verification email sent to ${to}`);
}

const OTP_COPY: Record<'VERIFY' | 'RESET', { subject: string; intro: string }> =
  {
    VERIFY: {
      subject: 'Your verification code — DIY Tutorials',
      intro: 'Use this code to verify your email address:',
    },
    RESET: {
      subject: 'Your password reset code — DIY Tutorials',
      intro: 'Use this code to reset your password:',
    },
  };

// Emails a 6-digit one-time password. Falls back to console logging when SMTP
// is not configured (dev), so the flow can still be completed locally.
export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: 'VERIFY' | 'RESET',
  ttlMinutes: number,
) {
  const { subject, intro } = OTP_COPY[purpose];

  if (!transporter) {
    console.log(`[email] SMTP not configured. ${purpose} code for ${to}:`);
    console.log(`[email]   ${code} (valid ${ttlMinutes} minutes)`);
    return;
  }

  await transporter.sendMail({
    from: env.email.from,
    to,
    subject,
    html: `
      <p>${intro}</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0;">${code}</p>
      <p>This code expires in ${ttlMinutes} minutes. If you didn't request it, you can ignore this email.</p>
    `,
  });
  console.log(`[email] ${purpose} code sent to ${to}`);
}
