import { describe, expect, it, vi } from "vitest";

import { documentStoragePath, formatFileSize, parseUploadRequest, sanitizeFileName } from "./document-rules";
import type { DocumentRepository } from "./document-repository";
import { createDocumentService } from "./document-service";

const CASE = "33333333-3333-4333-8333-333333333333";
const DOCUMENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("document rules (UC-36)", () => {
  it("makes file names safe for storage", () => {
    expect(sanitizeFileName("Schade foto’s (1).JPG")).toBe("Schade-foto-s-1.JPG");
    expect(sanitizeFileName("C:\\Users\\x\\aangifte é.pdf")).toBe("aangifte-e.pdf");
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("???.pdf")).toBe("document.pdf");
    expect(sanitizeFileName(`${"a".repeat(150)}.pdf`)).toHaveLength(100);
  });

  it("stores case documents under the case and shared documents apart", () => {
    expect(documentStoragePath({ caseId: CASE, documentId: DOCUMENT, fileName: "claim form.pdf" })).toBe(
      `cases/${CASE}/${DOCUMENT}/claim-form.pdf`,
    );
    expect(documentStoragePath({ caseId: null, documentId: DOCUMENT, fileName: "template.docx" })).toBe(
      `shared/${DOCUMENT}/template.docx`,
    );
  });

  it("accepts allowed files up to 20 MB", () => {
    const upload = { caseId: CASE, fileName: "photo.jpg", size: 3_000_000, mimeType: "image/jpeg", category: "photo" };
    expect(parseUploadRequest(upload).ok).toBe(true);
    expect(parseUploadRequest({ ...upload, size: 21 * 1024 * 1024 })).toMatchObject({
      ok: false,
      fieldErrors: { size: ["The file is larger than 20 MB."] },
    });
    expect(parseUploadRequest({ ...upload, mimeType: "application/x-msdownload" }).ok).toBe(false);
    expect(parseUploadRequest({ ...upload, mimeType: "" }).ok).toBe(false);
    expect(parseUploadRequest({ ...upload, category: "selfie" }).ok).toBe(false);
  });

  it("formats file sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3_500_000)).toBe("3.3 MB");
  });
});

describe("document service", () => {
  function fakeRepository(overrides: Partial<DocumentRepository> = {}): DocumentRepository {
    return {
      list: vi.fn(),
      getById: vi.fn(async () => null),
      createUploadUrl: vi.fn(async () => "https://storage.example/upload?token=t"),
      objectInfo: vi.fn(async () => ({ size: 1234, mimeType: "application/pdf" })),
      insert: vi.fn(async () => ({ ok: true as const, id: DOCUMENT })),
      delete: vi.fn(async () => true),
      removeObject: vi.fn(async () => undefined),
      downloadUrl: vi.fn(async () => null),
      ...overrides,
    };
  }

  it("issues an upload URL for the document's storage path", async () => {
    const repository = fakeRepository();
    const result = await createDocumentService(repository, () => DOCUMENT).prepareUpload({
      caseId: CASE,
      fileName: "claim form.pdf",
      size: 1234,
      mimeType: "application/pdf",
      category: "claim_form",
    });
    expect(result).toEqual({ ok: true, upload: { documentId: DOCUMENT, uploadUrl: "https://storage.example/upload?token=t" } });
    expect(repository.createUploadUrl).toHaveBeenCalledWith(`cases/${CASE}/${DOCUMENT}/claim-form.pdf`);
  });

  it("registers the upload with the size and type Storage received", async () => {
    const repository = fakeRepository();
    await createDocumentService(repository).confirmUpload({
      documentId: DOCUMENT,
      caseId: CASE,
      fileName: "claim form.pdf",
      category: "claim_form",
    });
    expect(repository.insert).toHaveBeenCalledWith({
      id: DOCUMENT,
      caseId: CASE,
      fileName: "claim form.pdf",
      size: 1234,
      mimeType: "application/pdf",
      category: "claim_form",
      storagePath: `cases/${CASE}/${DOCUMENT}/claim-form.pdf`,
    });
  });

  it("does not register a file that never arrived", async () => {
    const repository = fakeRepository({ objectInfo: vi.fn(async () => null) });
    const result = await createDocumentService(repository).confirmUpload({
      documentId: DOCUMENT,
      caseId: CASE,
      fileName: "x.pdf",
      category: "other",
    });
    expect(result).toEqual({ ok: false, error: "The file did not arrive. Please upload it again." });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("removes the record and then the stored file", async () => {
    const repository = fakeRepository({
      getById: vi.fn(async () => ({ id: DOCUMENT, caseId: CASE, fileName: "x.pdf", storagePath: "cases/x.pdf" })),
    });
    await expect(createDocumentService(repository).remove(DOCUMENT)).resolves.toEqual({ ok: true, caseId: CASE });
    expect(repository.delete).toHaveBeenCalledWith(DOCUMENT);
    expect(repository.removeObject).toHaveBeenCalledWith("cases/x.pdf");
  });
});
