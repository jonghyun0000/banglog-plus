import { useState } from "react";
import type { Intake } from "../../../shared/schema";
import { formatRepairBudget } from "./repair-cost-cases";

type LightingProduct = {
  id: string;
  form: Exclude<Intake["lighting"], "unknown" | undefined>;
  name: string;
  example: string;
  specs: string;
  price: number;
  listing?: { id: string; url: string };
};

// 2026-11-12 사용자 제공 표의 제품 참고가. 공임·출장비 미포함.
const products: readonly LightingProduct[] = [
  {
    id: "led-bulb",
    form: "replaceable",
    name: "일반 LED 전구",
    example: "번개표 LED전구 10W",
    specs: "E26 소켓 · 10W · 220V · 색온도 확인",
    price: 1900,
    listing: {
      id: "1000527846837",
      url: "https://www.ssg.com/item/itemView.ssg?itemId=1000527846837",
    },
  },
  {
    id: "fpl",
    form: "replaceable",
    name: "FPL 형광등",
    example: "FPL 32W 4핀",
    specs: "램프 형태와 핀 규격 · 소비전력 · 기존 안정기 호환",
    price: 2950,
  },
  {
    id: "room",
    form: "integrated",
    name: "LED 일체형 방등",
    example: "LED 방등 50W",
    specs: "등기구 크기 · 소비전력 · 컨버터 호환",
    price: 38000,
  },
  {
    id: "downlight",
    form: "integrated",
    name: "LED 다운라이트",
    example: "6인치 LED 다운라이트 15W",
    specs: "천장 타공 지름 · 소비전력 · 전원 방식",
    price: 4200,
  },
  {
    id: "kitchen",
    form: "integrated",
    name: "LED 주방등",
    example: "LED 주방등 40W",
    specs: "등기구 길이 · 소비전력 · 직부형·매입형 구분",
    price: 32000,
  },
  {
    id: "bathroom",
    form: "integrated",
    name: "LED 욕실 방습등",
    example: "LED 욕실등 20W 방습형",
    specs: "설치 위치에 맞는 방수·방습 등급 · 등기구 크기 · 소비전력",
    price: 26000,
  },
  {
    id: "living",
    form: "integrated",
    name: "LED 거실등",
    example: "LED 거실등 65~100W",
    specs: "등기구 크기 · 소비전력 · 컨버터 호환",
    price: 85000,
  },
  {
    id: "entry",
    form: "integrated",
    name: "LED 현관 센서등",
    example: "LED 센서등 20W",
    specs: "센서 방식 · 소비전력 · 직부형·매입형 구분",
    price: 20000,
  },
];

export function LightingPriceGuide({
  lighting,
}: {
  lighting: Intake["lighting"];
}) {
  const [selected, setSelected] = useState("");
  const choices = products.filter(
    (product) =>
      !lighting || lighting === "unknown" || product.form === lighting,
  );
  const product = choices.find((item) => item.id === selected);
  return (
    <section
      className="result-card repair-cost-examples"
      aria-labelledby="repair-cost-title"
    >
      <h2 id="repair-cost-title" tabIndex={-1}>
        조명 규격·제품 가격
      </h2>
      <label className="lighting-price-field">
        내 조명 종류
        <select
          value={product?.id ?? ""}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">조명 종류 선택</option>
          {choices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div aria-live="polite">
        {product && (
          <div className="lighting-price-item repair-cost-item">
            <div className="repair-cost-item-heading">
              <strong>{product.name}</strong>
              <strong className="repair-cost-amount">
                약 {formatRepairBudget(product.price)}
              </strong>
            </div>
            <p className="small">제품 참고가 · 2026.11.12 조사 자료</p>
            <p>제품 예시 {product.example}</p>
            <p>확인할 규격 {product.specs}</p>
            {product.listing && (
              <a href={product.listing.url} target="_blank" rel="noreferrer">
                상품번호 {product.listing.id} 확인 ↗
              </a>
            )}
            <p className="small">
              제품가에 공임·출장비는 포함되지 않아요.{" "}
              {product.form === "integrated"
                ? "등기구 점검 후 필요한 작업과 제품 규격을 확인하세요."
                : "교체 전 기존 조명의 표기와 규격을 비교하세요."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
