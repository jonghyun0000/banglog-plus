import { issueChoices } from "../../../shared/questions";
import type { Issue } from "../../../shared/schema";
import { Button, ArrowIcon, SectionTitle } from "../../components/ui/Elements";
export function Home({
  onStart,
  onPrivacy,
  onReferences,
}: {
  onStart: () => void;
  onPrivacy: () => void;
  onReferences: () => void;
}) {
  return (
    <div className="home">
      <div className="home-copy">
        <p className="eyebrow">전·월세 세입자를 위한 AI 수리 가이드</p>
        <h1 tabIndex={-1}>
          이거, 누가
          <br />
          고쳐야 하지?
        </h1>
        <p className="home-description">
          집주인에게 요청할지,
          <br />
          비용 협의에 필요한 내용을 정리해요.
        </p>
        <p className="scope">
          곰팡이 · 누수 · 보일러
          <br />
          벽지·장판 · 배수 · 옵션 제품
        </p>
      </div>
      <div className="home-action">
        <Button onClick={onStart}>
          내 상황 확인하기 <ArrowIcon />
        </Button>
        <p className="small disclaimer">
          AI 안내이며, 법적 판단을 확정하지 않아요.
        </p>
        <button className="text-button" onClick={onReferences}>
          수리 전 참고 판례 보기
        </button>
        <button className="text-button muted" onClick={onPrivacy}>
          개인정보·이용 안내
        </button>
      </div>
    </div>
  );
}
function IssueIcon({ issue }: { issue: Issue }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="28"
      height="28"
      fill="none"
      aria-hidden="true"
    >
      {issue === "mold" ? (
        <>
          <path
            d="M6 26V7h20v19M6 17h20M16 7v19"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="22" cy="22" r="2" fill="currentColor" />
          <circle cx="24" cy="26" r="1" fill="currentColor" />
        </>
      ) : issue === "leak" ? (
        <>
          <path
            d="M16 4S7 15 7 20a9 9 0 0 0 18 0c0-5-9-16-9-16Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M12 21c0 2 2 4 4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      ) : issue === "surface" ? (
        <path
          d="M5 5h22v22H5ZM18 5l-5 9 6 4-5 9M5 22h8"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      ) : issue === "drain" ? (
        <path
          d="M5 6v8a6 6 0 0 0 6 6h4v7h7V13H12V6M9 25l-4 4M25 5l3 3-3 3"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      ) : (
        <>
          <rect
            x="7"
            y="4"
            width="18"
            height="23"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M11 10h10M12 27v3M20 27v3"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle
            cx="16"
            cy="19"
            r="3"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </>
      )}
    </svg>
  );
}
export function IssuePicker({ onPick }: { onPick: (issue: Issue) => void }) {
  return (
    <>
      <SectionTitle eyebrow="상황 확인" title="어떤 문제가 생겼나요?">
        <p>가장 먼저 확인하고 싶은 문제를 골라주세요.</p>
      </SectionTitle>
      <div className="issue-list">
        {issueChoices.map(({ issue, title, detail }) => (
          <button
            className="issue-option"
            key={issue}
            onClick={() => onPick(issue)}
          >
            <span className="issue-icon">
              <IssueIcon issue={issue} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
            <ArrowIcon />
          </button>
        ))}
      </div>
      <p className="small quiet-note">
        사진이나 입주 기록이 없어도 괜찮아요.
        <br />
        지금 알고 있는 내용부터 함께 확인해요.
      </p>
    </>
  );
}
