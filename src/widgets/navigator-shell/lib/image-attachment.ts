import type { NavigatorAttachmentDto } from "@/features/execute-navigator-action";

export const MAX_IMAGE_ATTACHMENTS = 3;
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION_PX = 1600;

export type AllowedImageMimeType = NavigatorAttachmentDto["mimeType"];

const ALLOWED_IMAGE_MIME_TYPES = new Set<string>(["image/png", "image/jpeg", "image/webp"]);

/**
 * 지원되는 멀티모달 이미지 MIME 타입인지 판별합니다.
 */
export function isAllowedImageMimeType(mimeType: string): mimeType is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
}

/**
 * File 객체를 Data URL 문자열로 읽어들입니다.
 */
function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("이미지 파일을 읽지 못했습니다."));
      }
    };
    reader.onerror = () => reject(new Error("이미지 파일 읽기 중 오류가 발생했습니다."));
    reader.readAsDataURL(file);
  });
}

/**
 * 고해상도 이미지 파일을 Gemini Vision 전송에 적합한 해상도(최대 변 1600px)로 축소하여
 * `NavigatorAttachmentDto` 규격으로 변환합니다.
 *
 * 브라우저 Canvas API를 사용할 수 없는 테스트/폴백 환경에서는 원본 Data URL을 반환합니다.
 */
export async function resizeImageFileToAttachment(file: File): Promise<NavigatorAttachmentDto> {
  if (!isAllowedImageMimeType(file.type)) {
    throw new Error("PNG, JPEG, WEBP 형식의 이미지만 첨부할 수 있습니다.");
  }

  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error("첨부 이미지는 파일당 10MB 이하만 허용됩니다.");
  }

  const rawDataUrl = await readFileAsDataUrl(file);

  if (typeof document === "undefined" || typeof Image === "undefined") {
    return {
      name: file.name,
      mimeType: file.type,
      dataUrl: rawDataUrl,
    };
  }

  // Canvas 2D 컨텍스트 미지원 환경(jsdom 등)에서는 Image 디코딩 대기를 건너뛰고 원본을 반환합니다.
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      name: file.name,
      mimeType: file.type,
      dataUrl: rawDataUrl,
    };
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => reject(new Error("이미지 디코딩 시간 초과")), 2000);
      image.onload = () => {
        clearTimeout(timer);
        resolve(image);
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new Error("이미지를 디코딩할 수 없습니다."));
      };
      image.src = rawDataUrl;
    });

    const maxSide = Math.max(img.width, img.height);
    if (maxSide <= MAX_IMAGE_DIMENSION_PX || maxSide === 0) {
      return {
        name: file.name,
        mimeType: file.type,
        dataUrl: rawDataUrl,
      };
    }

    const scale = MAX_IMAGE_DIMENSION_PX / maxSide;
    const targetWidth = Math.max(1, Math.round(img.width * scale));
    const targetHeight = Math.max(1, Math.round(img.height * scale));
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const outputMime: AllowedImageMimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const compressedUrl = canvas.toDataURL(outputMime, 0.85);

    return {
      name: file.name,
      mimeType: outputMime,
      dataUrl: compressedUrl,
    };
  } catch {
    return {
      name: file.name,
      mimeType: file.type,
      dataUrl: rawDataUrl,
    };
  }
}
