import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import { formatDate, formatDateTime, zonedDate } from "@/domain/shared/time";

import { partyOf, type CaseMailContext, type MailParty } from "./merge-fields";

/** UC-13: the generated repair order's file name. */
export function repairOrderFileName(caseNumber: string): string {
  return `repair-order-${caseNumber}.pdf`;
}

const PAGE = { width: 595.28, height: 841.89, margin: 50 }; // A4 in points
const TEXT = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.4, 0.4);

/** Characters the standard PDF font cannot draw are replaced, so any name still prints. */
function printable(font: PDFFont, value: string): string {
  const supported = new Set(font.getCharacterSet());
  return [...value.replace(/\t/g, " ")].map((char) => (supported.has(char.codePointAt(0)!) ? char : "?")).join("");
}

/** Wraps text to the width available, keeping its line breaks. */
function wrap(font: PDFFont, size: number, value: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of printable(font, value).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width || line === "") {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

type Writer = {
  heading(text: string): void;
  field(label: string, value: string | null | undefined): void;
  paragraph(text: string, options?: { muted?: boolean }): void;
  gap(size?: number): void;
};

function createWriter(document: PDFDocument, regular: PDFFont, bold: PDFFont): Writer {
  let page: PDFPage = document.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  const width = PAGE.width - 2 * PAGE.margin;

  function ensure(height: number) {
    if (y - height < PAGE.margin) {
      page = document.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }
  }

  function line(text: string, font: PDFFont, size: number, x: number, color = TEXT) {
    ensure(size + 4);
    page.drawText(text, { x, y: y - size, size, font, color });
    y -= size + 4;
  }

  return {
    heading(text) {
      y -= 8;
      line(printable(bold, text), bold, 12, PAGE.margin);
    },
    field(label, value) {
      const labelWidth = 150;
      const lines = wrap(regular, 10, value?.trim() ? value : "—", width - labelWidth);
      ensure(14 * lines.length);
      page.drawText(printable(regular, label), { x: PAGE.margin, y: y - 10, size: 10, font: regular, color: MUTED });
      for (const text of lines) {
        line(text, regular, 10, PAGE.margin + labelWidth);
      }
    },
    paragraph(text, options) {
      for (const textLine of wrap(regular, 10, text, width)) {
        line(textLine, regular, 10, PAGE.margin, options?.muted ? MUTED : TEXT);
      }
    },
    gap(size = 6) {
      y -= size;
    },
  };
}

function partyLine(party: MailParty | null): string | null {
  if (!party) {
    return null;
  }
  const name = [party.accountName, party.contactName].filter(Boolean).join(" – ");
  return [name, party.phone, party.email].filter(Boolean).join(", ") || null;
}

/**
 * UC-13: the repair order for the case's repairer, with the repairer's
 * invoicing conditions and agreed discount printed on it (BR-09, UC-32).
 */
export async function renderRepairOrderPdf(
  context: CaseMailContext,
  options: { issuedAt: Date; companyName: string; invoicingEmail: string | null },
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Repair order ${context.caseNumber}`);
  document.setCreator(options.companyName);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const write = createWriter(document, regular, bold);
  const repairer = partyOf(context, "repairer");

  write.paragraph(options.companyName, { muted: true });
  write.heading(`Repair order ${context.caseNumber}`);
  write.field("Date", formatDate(zonedDate(options.issuedAt)));
  write.field("Repairer", repairer ? [repairer.accountName, repairer.address].filter(Boolean).join(", ") : null);
  write.field("Repair appointment", context.appointmentRepairAt ? formatDateTime(context.appointmentRepairAt) : null);

  write.heading("Client and references");
  write.field("Client (invoice party)", context.client ? [context.client.name, context.client.address].filter(Boolean).join(", ") : null);
  write.field("Insurer reference", context.insurerRef);
  write.field("Broker reference", context.brokerRef);
  write.field("Policy number", context.policyNumber);
  if (context.vdaNumber || context.poNumber) {
    write.field("VDA number", context.vdaNumber);
    write.field("PO number", context.poNumber);
  }

  write.heading("Vehicle");
  write.field("Licence plate", context.vehicle?.licencePlate);
  write.field("Make and model", [context.vehicle?.make, context.vehicle?.model].filter(Boolean).join(" ") || null);
  write.field("VIN", context.vehicle?.vin);
  write.field("First registration", context.vehicle?.firstRegistrationDate ? formatDate(context.vehicle.firstRegistrationDate) : null);

  write.heading("Contacts");
  write.field("Driver", partyLine(partyOf(context, "driver")));
  write.field("Intermediary", partyLine(partyOf(context, "intermediary")));
  write.field("Expert", partyLine(partyOf(context, "expert")));

  write.heading("Damage");
  write.field("Damage date", context.damage?.date ? formatDate(context.damage.date) : null);
  write.field("Cause", context.damage?.cause);
  write.field("Circumstances", context.damage?.circumstances);
  write.field("Damaged parts", context.damage?.parts.length ? context.damage.parts.join(", ") : null);
  write.field("Extra information", context.damage?.extraInfo);

  write.heading("Invoicing conditions");
  write.field("Agreed discount", repairer?.discountPct === null || repairer?.discountPct === undefined ? null : `${repairer.discountPct}%`);
  write.field("Conditions", repairer?.invoicingConditions);
  write.field("Send invoices to", options.invoicingEmail);
  write.gap();
  write.paragraph(
    `Always state case number ${context.caseNumber} on your estimate, your invoice and in the subject of your e-mails.`,
  );

  return document.save();
}
