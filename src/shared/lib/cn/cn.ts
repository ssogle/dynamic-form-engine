/**
 * Tailwind CSS 클래스명 조건부 병합 유틸리티 함수
 *
 * 외부 라이브러리(`cn`)와의 결합도를 격리하고 추상화 계층을 제공합니다.
 * clsx 및 tailwind-merge 호환 로직을 통해 충돌하는 Tailwind 클래스를 지능적으로 병합하고
 * falsy 값(false, null, undefined)을 자동으로 제거합니다.
 *
 * @param inputs 병합할 클래스명 또는 조건부 표현식 목록
 * @returns 안전하게 병합된 단일 클래스명 문자열
 */
export { cn } from "cn";
