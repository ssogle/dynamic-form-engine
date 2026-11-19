import { describe, it, expect } from "vitest";
import {
  isAllowedImageMimeType,
  MAX_IMAGE_FILE_BYTES,
  resizeImageFileToAttachment,
} from "./image-attachment";

describe("image-attachment (widgets/navigator-shell/lib)", () => {
  it("PNG, JPEG, WEBP MIME 타입만 허용하고 PDF/SVG 등은 거부해야 한다", () => {
    expect(isAllowedImageMimeType("image/png")).toBe(true);
    expect(isAllowedImageMimeType("image/jpeg")).toBe(true);
    expect(isAllowedImageMimeType("image/webp")).toBe(true);
    expect(isAllowedImageMimeType("application/pdf")).toBe(false);
    expect(isAllowedImageMimeType("image/svg+xml")).toBe(false);
  });

  it("허용되지 않은 형식이나 용량 초과 파일은 오류를 던져야 한다", async () => {
    const pdfFile = new File(["dummy"], "doc.pdf", { type: "application/pdf" });
    await expect(resizeImageFileToAttachment(pdfFile)).rejects.toThrow("PNG, JPEG, WEBP");

    const hugeFile = new File(["a"], "huge.png", { type: "image/png" });
    Object.defineProperty(hugeFile, "size", { value: MAX_IMAGE_FILE_BYTES + 1 });
    await expect(resizeImageFileToAttachment(hugeFile)).rejects.toThrow("10MB");
  });

  it("유효한 이미지 파일을 NavigatorAttachmentDto 규격의 Data URL로 변환해야 한다", async () => {
    const pngFile = new File(["hello"], "receipt.png", { type: "image/png" });
    const attachment = await resizeImageFileToAttachment(pngFile);

    expect(attachment.name).toBe("receipt.png");
    expect(attachment.mimeType).toBe("image/png");
    expect(attachment.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
