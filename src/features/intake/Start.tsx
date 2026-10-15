import type { Issue } from "../../../shared/schema";
import { Button, ArrowIcon, SectionTitle } from "../../components/ui/Elements";
export function Home({
  onStart,
  onPrivacy,
}: {
  onStart: () => void;
  onPrivacy: () => void;
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
          내가 비용을 부담할지 확인해요.
        </p>
        <p className="scope">
          곰팡이 <span>·</span> 누수 <span>·</span> 보일러
        </p>
      </div>
      <div className="home-action">
        <Button onClick={onStart}>
          내 상황 확인하기 <ArrowIcon />
        </Button>
        <p className="small disclaimer">
          AI 안내이며, 법적 판단을 확정하지 않아요.
        </p>
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
        {(["mold", "leak", "boiler"] as const).map((issue, i) => (
          <button
            className="issue-option"
            key={issue}
            onClick={() => onPick(issue)}
          >
            <span className="issue-icon">
              <IssueIcon issue={issue} />
            </span>
            <span>
              <strong>
                {["곰팡이가 생겼어요", "물이 새요", "보일러가 고장 났어요"][i]}
              </strong>
              <small>
                {
                  [
                    "벽·천장의 곰팡이, 창문의 결로",
                    "천장·벽·배관 주변의 물 샘",
                    "난방·온수·작동 문제",
                  ][i]
                }
              </small>
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
