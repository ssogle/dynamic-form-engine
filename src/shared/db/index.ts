/**
 * Database 인프라 클라이언트 안전 Public API 진입점
 *
 * 브라우저 클라이언트 컴포넌트("use client") 및 엔티티 스키마가 참조할 수 있는
 * 순수 DDL 테이블 객체만 노출합니다. (db 연결 인스턴스 및 server-only 완전 배제)
 */
export * from "./tables/forms.table";
export * from "./tables/form-submissions.table";
