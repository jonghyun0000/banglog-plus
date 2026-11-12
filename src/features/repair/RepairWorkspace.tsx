import {
  guideFields,
  mergeRepairGuide,
  prepareRepairFollowup,
  type RepairImport,
} from "../../../shared/repair-guide";
import { intakeIssueName, type Intake } from "../../../shared/schema";
import {
  intakeDetails,
  observationLabel,
  answerLabel,
} from "../../../shared/questions";
import { drainFacts } from "../../../shared/drain";
import { InspectionChecklist } from "./InspectionChecklist";
import { MoveOutCosts, MoveOutDraft } from "./MoveOutCosts";
import { PhotoCoaching, PhotoResult } from "../photos/PhotoResult";
import { useEffect, useRef, useState } from "react";
import {
  attachmentKinds,
  newRepair,
  repairMissing,
  repairText,
  type RepairRecord,
  type AttachmentKind,
} from "../../../shared/repair";
import {
  repairLegalReviews,
  repairReviewLabel,
} from "../../../shared/repair-review";
import {
  deleteRepair,
  getRepairFile,
  listRepairs,
  saveRepair,
  validateFile,
} from "./store";
import { Button } from "../../components/ui/Elements";
import "./repair.css";
function Attachment({ file, name }: { file: Blob; name: string }) {
  const media = useRef<HTMLImageElement & HTMLVideoElement>(null);
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    if (media.current) media.current.src = u;
    if (link.current) link.current.href = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div>
      {file.type.startsWith("image/") ? (
        <img ref={media} alt={name} />
      ) : file.type.startsWith("video/") ? (
        <video ref={media} controls preload="metadata" aria-label={name} />
      ) : (
        <p>PDF 문서 · {name}</p>
      )}
      <a ref={link} download={name}>
        파일 내려받기: {name}
      </a>
    </div>
  );
}
export function RepairWorkspace({
  request,
  onDismissImport,
  onFollowup,
}: {
  request: RepairImport | null;
  onDismissImport: () => void;
  onFollowup: (input: Intake, recordId: string) => void;
}) {
  const [records, setRecords] = useState<RepairRecord[]>([]);
  const [record, setRecord] = useState<RepairRecord | null>(null);
  const [files, setFiles] = useState<Map<string, Blob>>(new Map());
  const [removed, setRemoved] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importChoice, setImportChoice] = useState<{
    request: RepairImport;
    targetId?: string;
    images?: boolean;
  } | null>(null);
  const choice = importChoice?.request === request ? importChoice : null;
  const importImages = choice?.images ?? false;
  const [followupOpen, setFollowupOpen] = useState(false);
  const [useTechnician, setUseTechnician] = useState(false);
  const [useReply, setUseReply] = useState(false);
  const targetId = choice?.targetId ?? request?.targetId ?? "";
  const target =
    record?.id === targetId ? record : records.find((r) => r.id === targetId);
  const previousDraft = target?.guides.find(
    (g) => g.result.analysisId === request?.guide.result.analysisId,
  )?.draft;
  const latestReply =
    record?.contacts.filter((c) => c.reply.trim()).at(-1)?.reply ?? "";
  const technician = [record?.contractorOpinion, record?.inspectionAnswers]
    .filter(Boolean)
    .join("\n")
    .slice(0, 320);
  const candidate =
    record &&
    followupOpen &&
    ((useTechnician && technician) || (useReply && latestReply))
      ? prepareRepairFollowup(
          record,
          useTechnician ? technician : "",
          useReply ? latestReply.slice(0, 320) : "",
        )
      : null;

  function dismissImport() {
    setImportChoice(null);
    onDismissImport();
  }
  async function importGuide() {
    if (!request || !ready || busy) return;
    if (
      dirty &&
      target?.id !== record?.id &&
      !window.confirm("저장하지 않은 수정 내용을 버리고 선택한 기록을 열까요?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const base = target ?? newRepair();
      const next = mergeRepairGuide(
        base,
        request.guide,
        request.inspectionQuestions,
      );
      const sameRecord = base.id === record?.id;
      const nextFiles = sameRecord ? new Map(files) : new Map<string, Blob>();
      if (!sameRecord)
        for (const attachment of base.attachments) {
          const file = await getRepairFile(attachment.id);
          if (file) nextFiles.set(attachment.id, file);
        }
      if (importImages)
        for (const image of request.images) {
          const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(
            image,
          );
          if (!match) throw Error("가져올 사진 형식을 확인해 주세요.");
          const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
          const file = new File(
            [bytes],
            `분석에 사용한 사진.${match[1].split("/")[1]}`,
            { type: match[1] },
          );
          validateFile(file);
          if (
            next.attachments.length >= 30 ||
            next.attachments.reduce((sum, a) => sum + a.size, 0) + file.size >
              100 * 1024 * 1024
          ) {
            throw Error(
              "한 기록에는 파일 30개, 전체 100MB까지 저장할 수 있어요.",
            );
          }
          const id = crypto.randomUUID();
          nextFiles.set(id, file);
          next.attachments = [
            ...next.attachments,
            {
              id,
              kind: "discovery",
              name: file.name,
              type: file.type,
              size: file.size,
              capturedAt: "",
              recordedAt: new Date().toISOString(),
            },
          ];
        }
      setRecord(next);
      setFiles(nextFiles);
      if (!sameRecord) setRemoved([]);
      setAccepted(false);
      setDirty(true);
      setStep(0);
      setConfirmDelete(false);
      setFollowupOpen(false);
      setMessage("가져온 내용을 확인하고 이 기기에 저장하세요.");
      dismissImport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "내용을 가져오지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    listRepairs()
      .then((v) => {
        if (alive) {
          setRecords(v);
          setReady(true);
        }
      })
      .catch(() => {
        if (alive)
          setError(
            "이 브라우저에서 기록 저장소를 열지 못했어요. 브라우저의 저장 허용 설정을 확인해 주세요.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
  function patch(p: Partial<RepairRecord>) {
    setRecord((r) => (r ? { ...r, ...p } : r));
    setDirty(true);
    setMessage("");
  }
  async function select(r: RepairRecord) {
    if (
      dirty &&
      !window.confirm("저장하지 않은 수정 내용을 버리고 다른 기록을 열까요?")
    )
      return;
    setBusy(true);
    try {
      const f = new Map<string, Blob>();
      for (const a of r.attachments) {
        const b = await getRepairFile(a.id);
        if (b) f.set(a.id, b);
      }
      setFiles(f);
      setRecord(r);
      setRemoved([]);
      setAccepted(true);
      setDirty(false);
      setStep(0);
      setFollowupOpen(false);
      setError("");
    } catch {
      setError("기록을 열지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!record || !accepted) return;
    setBusy(true);
    setError("");
    try {
      const next = { ...record, updatedAt: new Date().toISOString() };
      await saveRepair(next, files, removed);
      setRecord(next);
      setRecords(await listRepairs());
      setRemoved([]);
      setDirty(false);
      setMessage("이 기기에 저장했어요. 상대방에게 전송된 것은 아니에요.");
    } catch {
      setError(
        "저장하지 못했어요. 저장 공간을 확인하고 파일을 줄여 다시 시도해 주세요. 입력 내용은 화면에 남아 있어요.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function attach(kind: AttachmentKind, list: FileList | null) {
    if (!record || !list) return;
    try {
      const added = Array.from(list);
      for (const f of added) {
        validateFile(f);
        if (
          (kind === "entry" || kind === "exit") &&
          !f.type.startsWith("image/")
        )
          throw Error("입주·퇴실 비교에는 사진만 첨부해 주세요.");
      }
      if (
        record.attachments.length + added.length > 30 ||
        [...files.values(), ...added].reduce((s, f) => s + f.size, 0) >
          100 * 1024 * 1024
      )
        throw Error("기록당 최대 30개, 총 100MB까지 첨부할 수 있어요.");
      const next = new Map(files);
      const metadata = added.map((f) => {
        const id = crypto.randomUUID();
        next.set(id, f);
        return {
          id,
          kind,
          name: f.name,
          type: f.type,
          size: f.size,
          capturedAt: "",
          recordedAt: new Date().toISOString(),
        };
      });
      setFiles(next);
      patch({ attachments: [...record.attachments, ...metadata] });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일을 첨부하지 못했어요.");
    }
  }
  function field(key: keyof RepairRecord, label: string, type = "text") {
    return (
      <label>
        {label}
        {type === "textarea" ? (
          <textarea
            maxLength={5000}
            value={String(record?.[key] ?? "")}
            onChange={(e) => patch({ [key]: e.target.value })}
          />
        ) : (
          <input
            type={type}
            maxLength={key === "location" ? 200 : 5000}
            value={String(record?.[key] ?? "")}
            onChange={(e) => patch({ [key]: e.target.value })}
          />
        )}
      </label>
    );
  }
  function uploads(kind: AttachmentKind) {
    return (
      <section className="repair-attachments">
        <label>
          {attachmentKinds[kind]} 첨부
          <input
            type="file"
            accept={
              kind === "entry" || kind === "exit"
                ? "image/jpeg,image/png,image/webp"
                : "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,application/pdf"
            }
            multiple
            onChange={(e) => {
              void attach(kind, e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {record?.attachments
          .filter((a) => a.kind === kind)
          .map((a) => (
            <div key={a.id} className="repair-file">
              {files.get(a.id) ? (
                <Attachment file={files.get(a.id)!} name={a.name} />
              ) : (
                <p>파일을 찾지 못했어요: {a.name}</p>
              )}
              <label>
                촬영·문서 작성 시각 (선택) · {a.name}
                <input
                  type="datetime-local"
                  value={a.capturedAt}
                  onChange={(e) =>
                    patch({
                      attachments: record.attachments.map((x) =>
                        x.id === a.id
                          ? { ...x, capturedAt: e.target.value }
                          : x,
                      ),
                    })
                  }
                />
              </label>
              <small>
                첨부 시각: {new Date(a.recordedAt).toLocaleString("ko-KR")}
              </small>
              <button
                type="button"
                onClick={() => {
                  setRemoved((v) => [...v, a.id]);
                  const next = new Map(files);
                  next.delete(a.id);
                  setFiles(next);
                  patch({
                    attachments: record.attachments.filter(
                      (x) => x.id !== a.id,
                    ),
                  });
                }}
              >
                첨부 삭제: {a.name}
              </button>
            </div>
          ))}
      </section>
    );
  }
  return (
    <section className="repair-workspace">
      <fieldset disabled={busy} className="repair-controls">
        <legend className="sr-only">수선 기록 입력</legend>
        <h1 tabIndex={-1}>수선 요청 기록장</h1>
        <p>
          발견부터 연락, 퇴실 비교까지 혼자 정리해요. 상대방 가입과 입주 사진은
          필요 없어요.
        </p>
        <details>
          <summary>기록·파일 보관 안내</summary>
          <p>
            이 기기의 브라우저에만 보관해요. 기존 회원 기록과 별개이며 다른
            기기로 동기화되지 않아요. 서버·GPT·상대방에게 전송하지 않아요. 공용
            기기에서는 사용 후 삭제해 주세요. 브라우저 데이터 삭제·기기 변경 시
            사라질 수 있으니 중요한 파일은 원본을 별도 보관하세요. 파일당 20MB,
            기록당 30개·100MB까지예요. 첨부를 열 때 얼굴·주소 등 불필요한 정보가
            없는지 확인하세요.
          </p>
        </details>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {request && (
          <section className="repair-import" aria-labelledby="import-title">
            <h2 id="import-title">기록장에 가져올 내용</h2>
            <p>
              {intakeIssueName(request.guide.intake)} ·{" "}
              {observationLabel(request.guide.intake)}
            </p>
            <p>{answerLabel("contact", request.guide.intake.contact)}</p>
            {intakeDetails(request.guide.intake).map(([label, value]) => (
              <p key={label}>
                <strong>{label}</strong> · {value}
              </p>
            ))}
            <p>{request.guide.intake.description}</p>
            <details>
              <summary>연락 문구 초안</summary>
              <pre>{request.guide.draft}</pre>
            </details>
            <label>
              추가할 기록
              <select
                value={targetId}
                onChange={(e) =>
                  setImportChoice({
                    ...choice,
                    request,
                    targetId: e.target.value,
                  })
                }
              >
                <option value="">새 기록</option>
                {record && !records.some((r) => r.id === record.id) && (
                  <option value={record.id}>지금 작성 중인 기록</option>
                )}
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.location || "위치 미입력"} ·{" "}
                    {r.discoveredAt || r.createdAt.slice(0, 10)}
                  </option>
                ))}
              </select>
            </label>
            {target && (
              <p>
                기존 연락·첨부·입력값을 보존하고 안내를 추가해요. 빈칸에 채울
                항목은{" "}
                {Object.entries(guideFields(request.guide))
                  .filter(
                    ([key, value]) =>
                      value && !target[key as keyof typeof target],
                  )
                  .map(
                    ([key]) =>
                      ({
                        location: "위치",
                        discoveredAt: "발견 시각",
                        impact: "사용 지장",
                        contractorOpinion: "업체 소견",
                        specialTerms: "특약",
                      })[key],
                  )
                  .join(", ") || "없어요"}
                .
              </p>
            )}
            {previousDraft !== undefined &&
              previousDraft !== request.guide.draft && (
                <details>
                  <summary>이 안내에 저장된 문구 초안을 교체해요</summary>
                  <p>기존 초안</p>
                  <pre>{previousDraft || "미입력"}</pre>
                  <p>가져올 초안</p>
                  <pre>{request.guide.draft || "미입력"}</pre>
                </details>
              )}
            {request.images.length > 0 && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={importImages}
                  onChange={(e) =>
                    setImportChoice({
                      ...choice,
                      request,
                      images: e.target.checked,
                    })
                  }
                />
                <span>
                  분석에 쓴 사진 {request.images.length}장도 이 기기에 보관할
                  초안에 추가해요.
                </span>
              </label>
            )}
            <Button
              disabled={!ready || busy}
              onClick={() => void importGuide()}
            >
              기록 초안에 가져오기
            </Button>
            <button className="text-button" onClick={dismissImport}>
              가져오기 취소
            </button>
          </section>
        )}
        <label>
          저장된 수선 기록
          <select
            disabled={busy || !ready}
            value={
              record && records.some((r) => r.id === record.id) ? record.id : ""
            }
            onChange={(e) => {
              const r = records.find((r) => r.id === e.target.value);
              if (r) void select(r);
            }}
          >
            <option value="">기록 선택</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.location || "위치 미입력"} ·{" "}
                {r.discoveredAt || "발견일 미입력"}
              </option>
            ))}
          </select>
        </label>
        <Button
          secondary
          disabled={busy || !ready}
          onClick={() => {
            if (
              dirty &&
              !window.confirm("저장하지 않은 내용을 버리고 새 기록을 만들까요?")
            )
              return;
            setRecord(newRepair());
            setFiles(new Map());
            setRemoved([]);
            setStep(0);
            setAccepted(false);
            setDirty(true);
            setMessage("");
            setConfirmDelete(false);
            setFollowupOpen(false);
          }}
        >
          새 수선 기록 만들기
        </Button>
        {record && (
          <>
            <nav className="repair-steps" aria-label="수선 기록 단계">
              {["1 발견·요청", "2 연락·응답", "3 퇴실·비용", "4 기록 요약"].map(
                (s, i) => (
                  <button
                    key={s}
                    aria-current={step === i ? "step" : undefined}
                    onClick={() => setStep(i)}
                  >
                    {s}
                  </button>
                ),
              )}
            </nav>
            {step === 0 && (
              <>
                <h2>어디에 어떤 문제가 생겼나요?</h2>
                {field("location", "문제 위치 (같은 위치끼리 비교)")}
                {field(
                  "discoveredAt",
                  "최초 발견 시각 (직접 입력)",
                  "datetime-local",
                )}
                {field("impact", "사용에 지장이 생긴 부분", "textarea")}
                {field("recurrence", "재발 시각·상황 (선택)", "textarea")}
                {field("inspection", "업체 점검일·내용 (선택)", "textarea")}
                {uploads("discovery")}
              </>
            )}
            {step === 1 && (
              <>
                <h2>실제로 연락한 내용을 남겨요</h2>
                <p>
                  저장 버튼은 메시지를 보내지 않아요. 실제 전달 시각·채널은
                  본인이 확인해서 입력해 주세요. 연락하지 않았어도 계속할 수
                  있어요.
                </p>
                <label>
                  임대인이 이미 알고 있었나요?
                  <select
                    value={record.landlordAware}
                    onChange={(e) =>
                      patch({
                        landlordAware: e.target
                          .value as RepairRecord["landlordAware"],
                      })
                    }
                  >
                    <option value="unknown">잘 모르겠어요</option>
                    <option value="yes">이미 알고 있었어요</option>
                    <option value="no">아직 모르고 있었어요</option>
                  </select>
                </label>
                {record.landlordAware === "yes" &&
                  field(
                    "awarenessEvidence",
                    "이미 알고 있던 정황·자료",
                    "textarea",
                  )}
                {record.contacts.map((c, i) => (
                  <fieldset key={c.id}>
                    <legend>연락 {i + 1}</legend>
                    {(
                      [
                        ["sentAt", "실제 전달 시각", "datetime-local"],
                        ["channel", "전달 채널 (문자·카톡·전화 등)", "text"],
                        ["content", "전달 내용", "textarea"],
                        ["replyAt", "답변 받은 시각", "datetime-local"],
                        ["reply", "임대인 답변 (없으면 비워두기)", "textarea"],
                      ] as const
                    ).map(([key, label, type]) => (
                      <label key={key}>
                        {label}
                        {type === "textarea" ? (
                          <textarea
                            maxLength={5000}
                            value={c[key]}
                            onChange={(e) =>
                              patch({
                                contacts: record.contacts.map((x) =>
                                  x.id === c.id
                                    ? { ...x, [key]: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          />
                        ) : (
                          <input
                            type={type}
                            maxLength={key === "channel" ? 100 : 5000}
                            value={c[key]}
                            onChange={(e) =>
                              patch({
                                contacts: record.contacts.map((x) =>
                                  x.id === c.id
                                    ? { ...x, [key]: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          />
                        )}
                      </label>
                    ))}
                    <small>
                      연락 기록 생성 시각:{" "}
                      {new Date(c.recordedAt).toLocaleString("ko-KR")} (전달
                      시각 아님)
                    </small>
                    <button
                      onClick={() =>
                        patch({
                          contacts: record.contacts.filter(
                            (x) => x.id !== c.id,
                          ),
                        })
                      }
                    >
                      연락 {i + 1} 삭제
                    </button>
                  </fieldset>
                ))}
                <Button
                  secondary
                  disabled={record.contacts.length >= 100}
                  onClick={() =>
                    patch({
                      contacts: [
                        ...record.contacts,
                        {
                          id: crypto.randomUUID(),
                          sentAt: "",
                          channel: "",
                          content: "",
                          replyAt: "",
                          reply: "",
                          recordedAt: new Date().toISOString(),
                        },
                      ],
                    })
                  }
                >
                  연락·응답 추가
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <h2>같은 위치의 입주·퇴실 비교</h2>
                <p>
                  비교 위치:{" "}
                  {record.location || "발견·요청에서 위치를 입력해 주세요."}
                </p>
                <label className="repair-check">
                  <input
                    type="checkbox"
                    checked={record.entryUnavailable}
                    onChange={(e) =>
                      patch({ entryUnavailable: e.target.checked })
                    }
                  />
                  입주 사진이 없어요
                </label>
                {record.entryUnavailable && (
                  <p>
                    사진 없이 계속할 수 있어요. 당시 메시지·점검표·기존 하자
                    메모가 있으면 함께 보관하세요. 사진이 없다고 책임이 정해지지
                    않아요.
                  </p>
                )}
                <div className="repair-compare">
                  <section>
                    <h3>입주 당시</h3>
                    {field("existingDamage", "기존 하자·입주 상태", "textarea")}
                    {uploads("entry")}
                  </section>
                  <section>
                    <h3>퇴실 당시</h3>
                    {field("exitCondition", "퇴실 상태·변화", "textarea")}
                    {uploads("exit")}
                  </section>
                </div>
                {field(
                  "deductionReason",
                  "임대인이 제시한 보증금 공제 사유",
                  "textarea",
                )}
                <MoveOutCosts record={record} onChange={patch} />
                {field(
                  "specialTerms",
                  "관련 계약 특약 (없음·모름도 입력 가능)",
                  "textarea",
                )}
                <MoveOutDraft key={record.id} record={record} />
                {field("quote", "견적 금액·항목", "textarea")}
                {uploads("quote")}
                {field("paidAmount", "실제 지출 금액·일자", "textarea")}
                {uploads("receipt")}
                {field("contractorOpinion", "업체 소견·확인일", "textarea")}
                <InspectionChecklist
                  selected={record.inspectionQuestions}
                  onChange={(keys) => patch({ inspectionQuestions: keys })}
                />
                {field(
                  "inspectionAnswers",
                  "점검 답변 · 원인·근거·확인 범위",
                  "textarea",
                )}
                {field(
                  "itemizedCost",
                  "항목별 금액 · 출장비·진단비·부품비·공임",
                  "textarea",
                )}
                <p className="small">
                  첨부한 증빙 · 견적{" "}
                  {record.attachments.filter((a) => a.kind === "quote").length}
                  건 / 영수증{" "}
                  {
                    record.attachments.filter((a) => a.kind === "receipt")
                      .length
                  }
                  건 / 업체 소견{" "}
                  {
                    record.attachments.filter((a) => a.kind === "opinion")
                      .length
                  }
                  건
                </p>
                {uploads("opinion")}
              </>
            )}
            {step === 3 && (
              <>
                <h2>확인된 사실과 필요한 자료</h2>
                <p>
                  아래는 사용자가 입력한 기록이에요. 상대방이 확인했거나
                  법적으로 입증된 사실이라는 뜻은 아니에요.
                </p>
                <dl className="repair-facts">
                  <dt>문제 위치</dt>
                  <dd>{record.location || "미입력"}</dd>
                  <dt>최초 발견</dt>
                  <dd>{record.discoveredAt || "미입력"}</dd>
                  <dt>사용 지장</dt>
                  <dd>{record.impact || "미입력"}</dd>
                  <dt>연락·응답</dt>
                  <dd>
                    {record.contacts.length}건 · 실제 전달 시각은 직접 입력한
                    내용
                  </dd>
                  <dt>입주·퇴실 자료</dt>
                  <dd>
                    {
                      record.attachments.filter((a) => a.kind === "entry")
                        .length
                    }{" "}
                    /{" "}
                    {record.attachments.filter((a) => a.kind === "exit").length}
                    장
                  </dd>
                </dl>
                <details>
                  <summary>전체 기록 내용 보기</summary>
                  <pre className="repair-summary">{repairText(record)}</pre>
                </details>
                <h3>추가로 필요한 자료</h3>
                <ul>
                  {repairMissing(record).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <Button
                  secondary
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(repairText(record));
                      setMessage(
                        "기록 내용을 복사했어요. 첨부파일은 포함되지 않아요.",
                      );
                    } catch {
                      setError(
                        "복사하지 못했어요. 위 내용을 직접 선택해 복사해 주세요.",
                      );
                    }
                  }}
                >
                  기록 요약 복사
                </Button>
                <h3>관련 공식 출처</h3>
                <p>
                  새 법률 자료 7건은 관리자 단독 승인 상태예요. 조문 5건은 일반
                  AI 안내에 사용하며, 조정사례 2건은 링크와 기록 체크리스트로만
                  참고해요. 팀 교차·법률 전문가 검토는 아직이에요. 조정사례는
                  법원 판결과 달라요.
                </p>
                {repairLegalReviews.map((r) => (
                  <p key={r.id}>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.title} ↗
                    </a>
                    <br />
                    <small>
                      {repairReviewLabel(r)} · 확인 {r.checkedAt}
                      {r.effectiveDate
                        ? ` · 시행 ${r.effectiveDate}`
                        : " · 게시 2022-07-14"}
                    </small>
                  </p>
                ))}
              </>
            )}
            {record.guides.length > 0 && (
              <section className="repair-import" aria-label="연결한 수리 안내">
                <h2>연결한 수리 안내</h2>
                {record.guides.map((guide, index) => (
                  <details key={guide.result.analysisId}>
                    <summary>
                      안내 {index + 1} · {intakeIssueName(guide.intake)} ·{" "}
                      {observationLabel(guide.intake)}
                    </summary>
                    <p className="small">
                      결과 번호 {guide.result.analysisId} · 근거 버전{" "}
                      {guide.result.retrieval?.datasetVersion ?? "미제공"}
                    </p>
                    <h3>사용자가 입력한 내용</h3>
                    <p>
                      {answerLabel("discovered", guide.intake.discovered)} ·{" "}
                      {answerLabel("contact", guide.intake.contact)}
                    </p>
                    {intakeDetails(guide.intake).map(([label, value]) => (
                      <p key={label}>
                        <strong>{label}</strong> · {value}
                      </p>
                    ))}
                    {drainFacts(guide.intake).map((fact) => (
                      <p key={fact.key}>{fact.value}</p>
                    ))}
                    <p>{guide.intake.description}</p>
                    <h3>
                      {guide.result.mode === "live" && !guide.result.fallback
                        ? "AI 안내"
                        : "기본 안내"}
                    </h3>
                    <p>
                      {guide.result.tailoredResponse?.summary ??
                        guide.result.aiExplanation ??
                        guide.result.repairRequest.reason}
                    </p>
                    <ul>
                      {guide.result.nextActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                    <PhotoResult photo={guide.result.photoAnalysis} />
                    <p>
                      <strong>추가 확인 항목</strong> ·{" "}
                      {guide.result.additionalChecks.join(" · ")}
                    </p>
                    <h3>연락 문구 초안</h3>
                    <pre>{guide.draft}</pre>
                  </details>
                ))}
                {record.guides.at(-1)!.result.status !== "safety_priority" && (
                  <PhotoCoaching
                    issue={record.guides.at(-1)!.intake.issue}
                    suggestions={
                      record.guides.at(-1)!.result.photoAnalysis
                        ?.missingPhotoGuide
                    }
                  />
                )}
                <Button
                  secondary
                  onClick={() => {
                    setFollowupOpen(!followupOpen);
                    setUseTechnician(false);
                    setUseReply(false);
                  }}
                >
                  추가 내용으로 다시 안내받기
                </Button>
                {followupOpen && (
                  <>
                    <p>
                      포함할 내용을 고르세요. 앞선 질문 답변과 함께 검토
                      화면에서 확인해요.
                    </p>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        disabled={!technician}
                        checked={useTechnician}
                        onChange={(e) => setUseTechnician(e.target.checked)}
                      />
                      <span>
                        업체 소견·점검 답변{" "}
                        {technician ? "포함" : "(기록 필요)"}
                      </span>
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        disabled={!latestReply}
                        checked={useReply}
                        onChange={(e) => setUseReply(e.target.checked)}
                      />
                      <span>
                        최근에 기록한 상대방 답변{" "}
                        {latestReply ? "포함" : "(기록 필요)"}
                      </span>
                    </label>
                    <Button
                      disabled={!candidate}
                      onClick={() => {
                        if (candidate) onFollowup(candidate, record.id);
                      }}
                    >
                      보낼 내용 확인하기
                    </Button>
                  </>
                )}
              </section>
            )}
            <div className="repair-save">
              <label className="repair-check">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                기록과 첨부파일을 이 기기에 보관하는 데 동의해요.
              </label>
              <p>
                {dirty
                  ? "아직 저장하지 않은 변경이 있어요."
                  : "저장된 내용이에요."}
                <br />앱 저장 시각:{" "}
                {records.some((r) => r.id === record.id)
                  ? new Date(record.updatedAt).toLocaleString("ko-KR")
                  : "아직 저장 전"}
              </p>
              <Button disabled={!accepted || busy} onClick={() => void save()}>
                {busy ? "처리 중…" : "이 기기에 기록 저장"}
              </Button>
              {step < 3 && (
                <Button secondary onClick={() => setStep(step + 1)}>
                  다음 기록 단계
                </Button>
              )}
              <button onClick={() => setConfirmDelete(true)}>
                현재 수선 기록 삭제
              </button>
              {confirmDelete && (
                <div role="alert">
                  <p>현재 기록과 첨부파일을 이 기기에서 삭제할까요?</p>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await deleteRepair(record);
                        setRecords(await listRepairs());
                        setRecord(null);
                        setFiles(new Map());
                        setDirty(false);
                        setConfirmDelete(false);
                        setMessage("기록과 첨부파일을 삭제했어요.");
                      } catch {
                        setError("삭제하지 못했어요. 다시 시도해 주세요.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    수선 기록 삭제 확인
                  </button>
                  <button onClick={() => setConfirmDelete(false)}>
                    삭제 취소
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </fieldset>
    </section>
  );
}
