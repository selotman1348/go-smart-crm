// Outbound e-mail through the transactional provider (Postmark's HTTP API).
// Without a server token, e-mails are recorded but not delivered.

export type OutgoingEmail = {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  attachments: { fileName: string; mimeType: string; content: Uint8Array }[];
};

export type SendResult = { ok: true } | { ok: false; error: string };

export type EmailTransport = {
  /** False when e-mails are recorded without being delivered. */
  delivers: boolean;
  send(email: OutgoingEmail): Promise<SendResult>;
};

/** Postmark's limit for one message, attachments included. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The HTML part of a plain-text body: paragraphs and line breaks, everything escaped. */
export function textToHtml(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, "<br>")}</p>`);
  return `<!doctype html><html><body style="font-family: Arial, sans-serif; font-size: 14px;">${paragraphs.join("")}</body></html>`;
}

export function createPostmarkTransport(serverToken: string, fetchImpl: typeof fetch = fetch): EmailTransport {
  return {
    delivers: true,
    async send(email) {
      let response: Response;
      try {
        response = await fetchImpl("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Postmark-Server-Token": serverToken,
          },
          body: JSON.stringify({
            From: email.from,
            To: email.to.join(", "),
            Cc: email.cc.join(", ") || undefined,
            Bcc: email.bcc.join(", ") || undefined,
            Subject: email.subject,
            TextBody: email.text,
            HtmlBody: textToHtml(email.text),
            MessageStream: "outbound",
            Attachments: email.attachments.map((attachment) => ({
              Name: attachment.fileName,
              Content: Buffer.from(attachment.content).toString("base64"),
              ContentType: attachment.mimeType,
            })),
          }),
        });
      } catch {
        return { ok: false, error: "The e-mail provider could not be reached." };
      }
      if (response.ok) {
        return { ok: true };
      }
      const body = (await response.json().catch(() => null)) as { Message?: unknown } | null;
      return {
        ok: false,
        error: typeof body?.Message === "string" ? `The e-mail provider refused it: ${body.Message}` : "The e-mail provider refused it.",
      };
    },
  };
}

/** For development and tests: accepts every e-mail and delivers none. */
export function createRecordOnlyTransport(): EmailTransport {
  return {
    delivers: false,
    async send() {
      return { ok: true };
    },
  };
}
