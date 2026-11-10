import type { Analysis } from "../../../shared/schema";
import { SectionTitle, Button } from "../../components/ui/Elements";
import { api } from "../../app/api";
import { DraftEditor } from "./DraftEditor";
import { NextResponse } from "../analysis/NextResponse";
export function Message({
  result,
  text,
  onChange,
  onSave,
  onFeedback,
}: {
  result: Analysis;
  text: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onFeedback: () => void;
}) {
  const recipient =
    result.repairRequest.recipient === "manager"
      ? "관리 담당자에게"
      : result.repairRequest.recipient === "service"
        ? "제조사·수리업체에"
        : "집주인에게";
  return (
    <div className="message-screen">
      <SectionTitle
        eyebrow={
          result.fallback
            ? "기본 안내 · 연락 문구"
            : result.mode === "mock"
              ? "데모: 가상 결과 · 연락 문구"
              : "연락 문구"
        }
        title="수정하고, 복사해서 보내세요"
      >
        <p>{recipient} 보낼 문구를 준비했어요.</p>
      </SectionTitle>
      <div className="message-purpose">
        <strong>
          {result.messageKind === "initial"
            ? "처음 점검 요청하기"
            : result.messageKind === "cost"
              ? "비용 부담의 근거 확인하기"
              : "이전 요청에 답변 부탁하기"}
        </strong>
        <p className="small">
          증상과 요청 사항을 확인하고, 내 상황에 맞게 고쳐주세요.
        </p>
      </div>
      <DraftEditor
        text={text}
        original={result.messageDraft}
        onChange={onChange}
        label={`${recipient} 보낼 문구`}
        onCopied={() => {
          void api.copied(result.analysisId).catch(() => {});
        }}
      />
      <Button secondary onClick={onSave}>
        문구와 결과를 내 기록에 저장
      </Button>
      <p className="small save-help">
        로그인 후 동의하면 수정한 문구도 함께 보관해요.
      </p>
      <NextResponse result={result} />
      <button className="text-button" onClick={onFeedback}>
        도움이 됐는지 알려주기
      </button>
    </div>
  );
}
