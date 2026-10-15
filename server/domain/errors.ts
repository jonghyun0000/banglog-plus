export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export const messages: Record<string, string> = {
  INVALID_INPUT:
    "입력을 확인해 주세요. 필수 선택 또는 글자 수가 올바르지 않아요.",
  UNAUTHORIZED: "이용 세션이 없거나 만료됐어요. 처음부터 다시 시작해 주세요.",
  NOT_FOUND: "이 세션에서 찾을 수 없는 기록이에요.",
  IDEMPOTENCY_CONFLICT:
    "같은 요청의 입력이 달라졌어요. 내용을 다시 확인해 주세요.",
  IN_PROGRESS: "같은 내용의 분석이 진행 중이에요. 잠시 후 다시 시도해 주세요.",
  CANCELLED: "분석을 취소했어요. 입력을 확인하고 다시 요청할 수 있어요.",
  RATE_LIMIT: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
  BUDGET_LIMIT: "오늘의 호출·토큰 또는 비용 한도에 도달했어요.",
  CONCURRENCY_LIMIT: "다른 분석을 처리 중이에요. 잠시 후 다시 시도해 주세요.",
  CONFIG_NOT_READY:
    "실제 모드 설정이 부족해요. 운영자에게 설정 확인을 요청해 주세요.",
  PROVIDER_TIMEOUT:
    "AI 응답 시간이 초과됐어요. 내용을 확인하고 다시 시도해 주세요.",
  PROVIDER_RATE_LIMIT:
    "AI 제공자의 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요.",
  PROVIDER_REFUSAL: "AI가 이 요청에 응답하지 못했어요. 내용을 확인해 주세요.",
  PROVIDER_OUTPUT: "AI 응답을 검증하지 못했어요. 결과를 저장하지 않았어요.",
  PROVIDER_FAILURE: "AI 처리에 실패했어요. 데모 결과로 대체하지 않았어요.",
  STORAGE_FAILURE: "저장소 처리에 실패했어요. 성공으로 기록하지 않았어요.",
  ORIGIN_DENIED: "허용되지 않은 요청 출처예요.",
  CONSENT_REQUIRED: "현재 처리 안내 확인이 필요해요.",
  INTERNAL_ERROR: "요청을 처리하지 못했어요. 다시 시도해 주세요.",
  PUBLIC_DISABLED: "공개 운영은 아직 활성화할 수 없어요.",
  FAILED: "이전 요청이 실패했어요. 내용을 확인하고 새로 분석해 주세요.",
};
