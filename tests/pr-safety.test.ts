import { it, expect } from "vitest";
import { defaultIntake } from "../shared/schema";
import { maskPersonalData, hasDanger, outOfScope } from "../shared/safety";
it("keeps dates readable and masks spaced or unbroken account numbers", () => {
  for (const text of [
    "2024-10-15 입주",
    "2026 11 03 처음 발견",
    "보일러 모델 RF-85-1234",
    "방 2개 중 10 20 30번 타일",
  ])
    expect(maskPersonalData(text), text).toBe(text);
  for (const text of [
    "계좌 110 123 456789",
    "계좌 110-123-456789",
    "계좌 110123456789",
    "02-123-4567",
    "010 1234 5678",
  ])
    expect(maskPersonalData(text), text).not.toMatch(/\d{3}/);
});
it("does not treat everyday wording as danger, and catches leaks and breaker trips", () => {
  const danger = (description: string) =>
    hasDanger({ ...defaultIntake, safety: "none", description });
  for (const text of [
    "집주인이 점검 일정을 계속 연기해요",
    "화재보험으로 처리하자고 해요",
    "연기 감지기 옆 천장에 물자국이 있어요",
    "누전 차단기 위치를 몰라요",
  ])
    expect(danger(text), text).toBe(false);
  for (const text of [
    "가스가 새는 것 같아요",
    "보일러에서 가스냄새가 나요",
    "누전 차단기가 계속 내려가요",
    "누전이 의심돼요",
    "콘센트에서 스파크가 튀었어요",
    "보일러실에 연기가 자욱해요",
    "주방에서 불이 났어요",
    "화재 경보기가 계속 울려요",
  ])
    expect(danger(text), text).toBe(true);
});
it("keeps repair situations in scope when they only mention excluded topics", () => {
  for (const text of [
    "집주인이 보증금 반환 때 수리비를 빼겠다고 해요",
    "소송하겠다고 협박해요",
    "상가주택 2층 원룸인데 천장에서 물이 새요",
    "매매로 집주인이 바뀌었어요",
  ])
    expect(outOfScope(text), text).toBe(false);
  for (const text of [
    "보증금 반환을 어떻게 청구하나요?",
    "보증금 반환 소송을 하려고 해요",
    "소송 절차를 알려주세요",
    "상가 임대차 계약의 수리 문제예요",
    "매매 계약 후 발견한 하자예요",
    "전세사기를 당한 것 같아요",
  ])
    expect(outOfScope(text), text).toBe(true);
});
