/**
 * Transactional email with a pluggable transport. Without RESEND_API_KEY the
 * "log" transport prints the message as a JSON line (links included) so the
 * flow can be exercised in development; nothing is sent.
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  name: "log" | "resend";
  send(mail: Mail): Promise<{ ok: true; id?: string } | { ok: false; error: string }>;
}

export const logMailer: Mailer = {
  name: "log",
  async send(mail) {
    console.log(JSON.stringify({ level: "info", event: "email.log", to: mail.to, subject: mail.subject, text: mail.text }));
    return { ok: true };
  },
};

/** Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email). Not exercised live in this repo yet. */
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    name: "resend",
    async send(mail) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return { ok: false, error: `resend ${res.status}` };
        const json = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: json.id };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

export function getMailer(): Mailer {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from) return resendMailer(key, from);
  return logMailer;
}

export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

export function passwordResetMail(to: string, token: string): Mail {
  const link = appUrl(`/reset-password?token=${token}`);
  return {
    to,
    subject: "Reset your Mentioned password",
    text: `Someone asked to reset the password for this Mentioned account.\n\nReset it here (valid for 1 hour):\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
  };
}

export function verifyEmailMail(to: string, token: string): Mail {
  const link = appUrl(`/verify-email?token=${token}`);
  return {
    to,
    subject: "Confirm your email for Mentioned",
    text: `Confirm this email address for your Mentioned account (valid for 7 days):\n${link}\n\nIf you did not create an account, you can ignore this email.`,
  };
}
