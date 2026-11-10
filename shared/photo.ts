import { z } from "zod";
export const photoSigns = {
  discoloration: "표면의 변색·얼룩",
  dark_spots: "검은 반점 또는 곰팡이로 의심되는 흔적",
  standing_water: "고여 있는 물",
  visible_debris: "눈에 보이는 이물질",
  tear: "찢어짐·들뜸",
  dent_crack: "찍힘·갈라짐",
  water_trace: "물자국·젖은 흔적",
  appliance_damage: "기기의 외관 손상",
  fire_smoke: "불꽃·연기로 의심되는 위험 징후",
  exposed_wiring: "노출되거나 손상된 배선 의심",
} as const;
export const photoSignSchema = z.enum(
  Object.keys(photoSigns) as [
    keyof typeof photoSigns,
    ...(keyof typeof photoSigns)[],
  ],
);
export const photoReadingSchema = z
  .object({
    relevant: z.boolean(),
    clear: z.boolean(),
    signs: z.array(photoSignSchema).max(6),
  })
  .strict();
export const photoResultSchema = z.object({
  status: z.enum(["analyzed", "unclear", "failed", "skipped"]),
  signs: z.array(photoSignSchema).max(6),
  count: z.number().int().min(1).max(3),
});
export type PhotoResult = z.infer<typeof photoResultSchema>;
// Only small re-encoded JPEGs; URLs, SVG and arbitrary files are never fetched.
export const photoInputSchema = z
  .string()
  .max(400000)
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/);
export const photoUploadSchema = z
  .object({
    consent: z.literal(true),
    images: z.array(photoInputSchema).min(1).max(3),
  })
  .strict();
export type PhotoUpload = z.infer<typeof photoUploadSchema>;
export function photoContext(photo?: PhotoResult) {
  return photo?.status === "analyzed"
    ? photo.signs.map((s) => photoSigns[s]).join(" · ")
    : "";
}
export function photoDanger(photo?: PhotoResult) {
  return (
    photo?.status === "analyzed" &&
    photo.signs.some((s) => s === "fire_smoke" || s === "exposed_wiring")
  );
}
export const photoChecks: Record<keyof typeof photoSigns, string> = {
  discoloration: "얼룩이 생긴 시점과 범위가 커지는지 기록해 주세요.",
  dark_spots: "누수·단열 점검 여부와 환기·습도 상황을 함께 확인해 주세요.",
  standing_water:
    "다른 배수구도 같은지, 넘침과 이미 사용한 약품이 있는지 확인해 주세요.",
  visible_debris:
    "이미 해본 청소와 약품 사용 여부를 점검 담당자에게 알려주세요.",
  tear: "입주 당시 사진과 손상이 생긴 시점을 비교해 주세요.",
  dent_crack: "입주 당시 상태와 균열·찍힘의 변화 여부를 기록해 주세요.",
  water_trace:
    "비가 올 때인지, 물을 사용할 때인지와 원인 위치 점검이 필요해요.",
  appliance_damage: "제품 소유자와 오류 표시, 교체·수리 이력을 확인해 주세요.",
  fire_smoke: "추가 촬영을 중단하고 안전한 곳에서 위험 여부를 확인해 주세요.",
  exposed_wiring:
    "배선이나 주변 물을 만지지 말고 안전한 곳에서 도움을 요청하세요.",
};
