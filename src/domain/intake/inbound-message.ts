import PostalMime, { type Address } from "postal-mime";

// A received e-mail in one shape, whatever its source: the provider's inbound
// webhook (plan.md 2.1) or an uploaded .eml file (the same pipeline).

export type InboundAttachmentInput = {
  fileName: string;
  mimeType: string;
  content: Uint8Array;
};

export type InboundMessage = {
  messageId: string | null;
  from: string | null;
  to: string[];
  cc: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  receivedAt: string | null;
  attachments: InboundAttachmentInput[];
};

/** "Name <address>", or the address alone. */
export function formatMailbox(address: string, name?: string | null): string {
  const cleanName = name?.replace(/["<>]/g, "").trim();
  return cleanName ? `${cleanName} <${address}>` : address;
}

/** The e-mail address in "Name <address>" (or the text itself). */
export function mailboxAddress(mailbox: string): string {
  const match = /<([^>]+)>\s*$/.exec(mailbox);
  return (match ? match[1] : mailbox).trim();
}

/** Message-IDs are compared without their angle brackets. */
function cleanMessageId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const id = value.trim().replace(/^<|>$/g, "");
  return id === "" ? null : id.slice(0, 500);
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.slice(0, max) : null;
}

const MAX_BODY = 200_000;

/**
 * Plain text from an HTML body, for e-mails without a text part. The HTML
 * itself is stored but never rendered.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The body as text: the text part, otherwise the HTML part as text. */
export function bodyText(message: Pick<InboundMessage, "text" | "html">): string | null {
  if (message.text && message.text.trim() !== "") {
    return message.text;
  }
  return message.html ? htmlToText(message.html) || null : null;
}

type PostmarkAddress = { Email?: unknown; Name?: unknown };
type PostmarkHeader = { Name?: unknown; Value?: unknown };
type PostmarkAttachment = { Name?: unknown; Content?: unknown; ContentType?: unknown };

function postmarkAddresses(list: unknown): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return (list as PostmarkAddress[])
    .filter((entry) => typeof entry?.Email === "string" && entry.Email !== "")
    .map((entry) => formatMailbox(entry.Email as string, typeof entry.Name === "string" ? entry.Name : null));
}

/**
 * The provider's inbound webhook payload (Postmark's inbound JSON format:
 * FromFull, ToFull, CcFull, Subject, TextBody, HtmlBody, Date, Headers and
 * base64 Attachments). Returns null when it is not such a payload.
 */
export function fromPostmark(payload: unknown): InboundMessage | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const body = payload as Record<string, unknown>;
  const fromFull = body.FromFull as PostmarkAddress | undefined;
  const from =
    typeof fromFull?.Email === "string" && fromFull.Email !== ""
      ? formatMailbox(fromFull.Email, typeof fromFull.Name === "string" ? fromFull.Name : null)
      : text(body.From, 500);
  if (!from && typeof body.Subject !== "string") {
    return null;
  }
  const headers = Array.isArray(body.Headers) ? (body.Headers as PostmarkHeader[]) : [];
  const messageIdHeader = headers.find(
    (header) => typeof header?.Name === "string" && header.Name.toLowerCase() === "message-id",
  )?.Value;
  const attachments = Array.isArray(body.Attachments) ? (body.Attachments as PostmarkAttachment[]) : [];

  return {
    messageId: cleanMessageId(messageIdHeader) ?? cleanMessageId(body.MessageID),
    from,
    to: postmarkAddresses(body.ToFull),
    cc: postmarkAddresses(body.CcFull),
    subject: text(body.Subject, 1000),
    text: text(body.TextBody, MAX_BODY),
    html: text(body.HtmlBody, MAX_BODY),
    receivedAt: isoDate(body.Date),
    attachments: attachments
      .filter((attachment) => typeof attachment?.Content === "string")
      .map((attachment) => ({
        fileName: typeof attachment.Name === "string" && attachment.Name !== "" ? attachment.Name : "attachment",
        mimeType:
          typeof attachment.ContentType === "string" && attachment.ContentType !== ""
            ? attachment.ContentType
            : "application/octet-stream",
        content: Uint8Array.from(Buffer.from(attachment.Content as string, "base64")),
      })),
  };
}

function mimeAddresses(list: Address[] | undefined): string[] {
  return (list ?? []).flatMap((entry) =>
    entry.group ? entry.group.map((member) => formatMailbox(member.address, member.name)) : [formatMailbox(entry.address, entry.name)],
  );
}

/** A raw e-mail (.eml, RFC 5322). Throws when it cannot be read as an e-mail. */
export async function fromEml(raw: Uint8Array | string): Promise<InboundMessage> {
  const email = await PostalMime.parse(raw, { attachmentEncoding: "arraybuffer" });
  const from = email.from ? mimeAddresses([email.from])[0] ?? null : null;
  if (!from && !email.subject && email.headers.length === 0) {
    throw new Error("This file is not an e-mail.");
  }
  return {
    messageId: cleanMessageId(email.messageId),
    from,
    to: mimeAddresses(email.to),
    cc: mimeAddresses(email.cc),
    subject: text(email.subject, 1000),
    text: text(email.text, MAX_BODY),
    html: text(email.html, MAX_BODY),
    receivedAt: isoDate(email.date),
    attachments: email.attachments
      .filter((attachment) => attachment.disposition !== "inline" || attachment.filename)
      .map((attachment) => ({
        fileName: attachment.filename || "attachment",
        mimeType: attachment.mimeType || "application/octet-stream",
        content:
          typeof attachment.content === "string"
            ? new TextEncoder().encode(attachment.content)
            : new Uint8Array(attachment.content as ArrayBuffer),
      })),
  };
}
