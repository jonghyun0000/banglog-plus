import { useEffect, useRef, useState } from "react";
import { buildingQuestions, type Building } from "../../../shared/building";
import type { Intake } from "../../../shared/schema";
type Address = {
  bcode: string;
  jibunAddress: string;
  autoJibunAddress: string;
  roadAddress: string;
};
type Picker = new (options: {
  oncomplete: (data: Address) => void;
  width: string;
  height: number;
}) => { embed: (element: HTMLElement, options?: { q: string }) => void };
declare global {
  interface Window {
    kakao?: { Postcode: Picker };
    daum?: { Postcode: Picker };
  }
}
type Lot = {
  code: string;
  bun: string;
  ji: string;
  mountain: boolean;
  page: number;
};
type Row = Building & { id: string; label: string };
export function BuildingLookup({
  input,
  onChange,
}: {
  input: Intake;
  onChange: (p: Partial<Intake>) => void;
}) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [address, setAddress] = useState(""),
    [rows, setRows] = useState<Row[]>([]),
    [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ query: "", attempt: 0 });
  const [lot, setLot] = useState<Lot | null>(null);
  const mount = useRef<HTMLDivElement>(null),
    request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function lookup(next: Lot) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("");
    setRows([]);
    setLot(next);
    onChange({ building: undefined });
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/buildings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
          signal: controller.signal,
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "건물 조회에 실패했어요.");
      if (controller.signal.aborted) return;
      setRows(data.items);
      setTotal(data.total);
      if (!data.items.length)
        setMessage(
          "일치하는 건물대장을 찾지 못했어요. 다른 주소를 검색하거나 건너뛰어 주세요.",
        );
    } catch (e) {
      if (!controller.signal.aborted)
        setMessage(e instanceof Error ? e.message : "건물 조회에 실패했어요.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    if (!open || !mount.current) return;
    let active = true;
    function show() {
      const P = window.kakao?.Postcode ?? window.daum?.Postcode;
      if (!active || !P || !mount.current) return;
      new P({
        width: "100%",
        height: 420,
        oncomplete(data) {
          if (!active) return;
          const jibun = data.jibunAddress || data.autoJibunAddress;
          const match = jibun.match(/(?:\s)(산\s*)?(\d+)(?:-(\d+))?$/);
          setOpen(false);
          setAddress(data.roadAddress || jibun);
          if (!match || !/^\d{10}$/.test(data.bcode)) {
            setMessage(
              "이 주소의 지번을 확인하지 못했어요. 지번 주소로 다시 검색해 주세요.",
            );
            return;
          }
          void lookup({
            code: data.bcode,
            bun: match[2],
            ji: match[3] || "0",
            mountain: !!match[1],
            page: 1,
          });
        },
      }).embed(mount.current, { q: search.query });
    }
    let script: HTMLScriptElement | undefined;
    if (window.kakao?.Postcode || window.daum?.Postcode) show();
    else {
      script = document.createElement("script");
      script.src =
        "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.onload = show;
      script.onerror = () => {
        if (active) {
          setOpen(false);
          setMessage("주소 검색을 열지 못했어요. 주소 없이 계속할 수 있어요.");
        }
      };
      document.head.append(script);
    }
    return () => {
      active = false;
      script?.remove();
    };
    // Address selection is handled within the lifetime of this search panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search]);
  const b = input.building,
    q = b ? buildingQuestions(b, input.issue) : null;
  return (
    <section className="building-lookup" aria-label="선택 건물 정보">
      <h2>
        건물 정보도 확인할까요? <span className="small">선택</span>
      </h2>
      <p className="small">
        주소 검색은 카카오, 건물 조회는 공공데이터 API를 이용해요. 주소·동호수는
        분석과 기록에 저장하지 않고, 선택한 용도·구조·사용승인일·층수와 추가
        답변만 함께 보관해요.
      </p>
      <form
        className="building-address-search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = query.trim();
          if (!value) return;
          request.current?.abort();
          setBusy(false);
          setRows([]);
          setLot(null);
          setTotal(0);
          setAddress("");
          setMessage("");
          onChange({ building: undefined });
          setSearch((previous) => ({
            query: value,
            attempt: previous.attempt + 1,
          }));
          setOpen(true);
        }}
      >
        <label htmlFor="building-address">주소 직접 입력</label>
        <input
          id="building-address"
          type="search"
          value={query}
          maxLength={120}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="예: 춘천시 한림대학길 1 / 역삼동 737"
          aria-describedby="building-address-help"
          onChange={(event) => {
            setQuery(event.target.value);
            request.current?.abort();
            setBusy(false);
            setOpen(false);
            setAddress("");
            setRows([]);
            setLot(null);
            setTotal(0);
            setMessage("");
            onChange({ building: undefined });
          }}
        />
        <p id="building-address-help" className="small">
          도로명·지번·건물명을 입력해 검색하세요. 동·호수는 입력하지 않아도
          돼요. 검색 결과에서 실제 주소를 확인하면 건물 정보를 가져와요.
        </p>
        <button
          type="submit"
          className="button secondary"
          disabled={!query.trim()}
        >
          주소 검색하기
        </button>
      </form>
      {open && (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            주소 검색 닫기
          </button>
          <div ref={mount} style={{ width: "100%", height: 420 }} />
        </>
      )}
      {address && <p>{address}</p>}
      {busy && <p role="status">건물대장을 확인하고 있어요…</p>}
      {message && <p role="status">{message}</p>}
      {!b && rows.length > 0 && (
        <fieldset>
          <legend>거주하는 건물을 선택해 주세요</legend>
          {rows.map((r) => (
            <button
              type="button"
              className="choice"
              key={r.id}
              onClick={() => {
                const { id: _id, label: _label, ...building } = r;
                void _id;
                void _label;
                onChange({ building });
              }}
            >
              {r.label} · {r.use || "용도 미등록"} · 지상 {r.floors}층<br />
              사용승인 {r.approval || "미등록"}
            </button>
          ))}
          {lot && (
            <div className="actions">
              <button
                type="button"
                disabled={busy || lot.page === 1}
                onClick={() => void lookup({ ...lot, page: lot.page - 1 })}
              >
                이전 건물
              </button>
              <span>
                {lot.page} / {Math.ceil(total / 20)}
              </span>
              <button
                type="button"
                disabled={busy || lot.page * 20 >= total || lot.page >= 100}
                onClick={() => void lookup({ ...lot, page: lot.page + 1 })}
              >
                다음 건물
              </button>
            </div>
          )}
        </fieldset>
      )}
      {b && q && (
        <>
          <p>
            <strong>선택한 건축물대장 정보</strong>
            <br />
            {b.use || "용도 미등록"} · {b.structure || "구조 미등록"} · 지상{" "}
            {b.floors}층<br />
            사용승인일 {b.approval || "미등록"}
          </p>
          <p className="small">
            승인일은 {q.part}의 교체 시기나 하자 원인을 알려주지 않아요. 실제
            거주 건물과 맞는지 확인해 주세요.
          </p>
          <label>
            {q.repair}
            <select
              value={b.repairHistory}
              onChange={(e) =>
                onChange({
                  building: {
                    ...b,
                    repairHistory: e.target.value as Building["repairHistory"],
                  },
                })
              }
            >
              <option value="unknown">잘 모르겠어요</option>
              <option value="yes">교체·수리 이력을 알고 있어요</option>
              <option value="no">알고 있는 교체·수리 이력이 없어요</option>
            </select>
          </label>
          {b.repairHistory === "yes" && (
            <p className="small">
              아래 추가 설명에 수리한 부위·시기와 점검 내용을 적어 주세요.
            </p>
          )}
          {q.manager && (
            <label>
              이 건물의 관리사무소나 관리 담당자에게 점검을 요청할 수 있나요?
              <select
                value={b.manager}
                onChange={(e) =>
                  onChange({
                    building: {
                      ...b,
                      manager: e.target.value as Building["manager"],
                    },
                  })
                }
              >
                <option value="unknown">아직 확인하지 못했어요</option>
                <option value="yes">연락할 담당자가 있어요</option>
                <option value="no">알고 있는 담당자가 없어요</option>
              </select>
            </label>
          )}
        </>
      )}
      {(b || address || open || query) && (
        <button
          type="button"
          onClick={() => {
            request.current?.abort();
            setBusy(false);
            onChange({ building: undefined });
            setRows([]);
            setAddress("");
            setLot(null);
            setMessage("");
            setOpen(false);
            setQuery("");
          }}
        >
          건물 정보 없이 계속하기
        </button>
      )}
    </section>
  );
}
