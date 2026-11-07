import "server-only";

/**
 * Form 엔티티 서버 전용 Public API 진입점
 *
 * Next.js App Router의 Server/Client 경계 분리 원칙에 따라,
 * Drizzle ORM DB 직접 쿼리 및 서버 전용 비즈니스 로직은
 * 클라이언트 번들에 유출되지 않도록 본 server.ts를 통해서만 제공됩니다.
 *
 * @see https://nextjs.org/docs/app/building-your-application/rendering/server-components
 */
export {
  findActiveForms,
  findFormById,
  findFormBySlug,
  findPublishedForms,
  findPublishedFormBySlug,
  insertForm,
  updateFormById,
  softDeleteFormById,
  softDeleteFormsBySlugs,
} from "./server/form.server";
