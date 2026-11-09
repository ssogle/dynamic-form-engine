/**
 * Database 인프라 클라이언트 안전 Public API 진입점
 *
 * 브라우저 클라이언트 컴포넌트("use client") 및 엔티티 스키마가 참조할 수 있도록
 * 물리 DDL 테이블 객체를 re-export합니다. (신규 코드는 @/shared/tables 직접 import 권장)
 */
export * from "@/shared/tables";
