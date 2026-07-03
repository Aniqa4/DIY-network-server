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
