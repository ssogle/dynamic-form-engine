import "server-only";

/**
 * Form Submission 엔티티 서버 전용 Public API
 *
 * App Router Server Component, Server Action, Route Handler에서만 안전하게 import하여 사용합니다.
 */
export {
  insertSubmission,
  findSubmissionsByFormId,
  findSubmissionById,
  updateSubmissionById,
  softDeleteSubmissionById,
} from "./server/form-submission.server";
