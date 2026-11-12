import { z } from "zod";
import type { Intake, Issue } from "./schema.js";
import { isLightingIssue } from "./lighting.js";

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
type Sign = z.infer<typeof photoSignSchema>;

const locations = {
  window_edge: "창틀 가장자리",
  window_seal: "창틀 실리콘 주변",
  wall_corner: "벽 모서리",
  wall_surface: "벽면",
  ceiling: "천장",
  floor_edge: "바닥 가장자리",
  floor_surface: "바닥",
  around_drain: "배수구 주변",
  basin: "세면대 또는 싱크대 내부",
  visible_pipe: "노출된 배관 주변",
  cabinet: "수납장 주변",
  appliance: "기기 겉면",
  display: "기기 화면",
  label: "기기 라벨",
  unknown: "사진 속 문제 부위",
} as const;
const views = {
  overview: [
    "문제 부위와 주변이 함께 보이는 전체 사진",
    "방·설비에서 문제가 생긴 위치와 범위를 전달할 수 있어요.",
  ],
  closeup: [
    "문제 부위를 가까이 찍은 사진",
    "얼룩이나 손상의 모양과 범위를 비교할 수 있어요.",
  ],
  display: [
    "기기 화면을 정면에서 찍은 사진",
    "오류 표시와 온도·설정값을 구분하는 데 도움이 돼요.",
  ],
  label: [
    "라벨에서 제조연월만 보이게 자른 사진",
    "제조 시기를 확인하는 데 도움이 돼요. 일련번호와 QR은 가려주세요.",
  ],
  drain: [
    "배수구와 주변 바닥이 함께 보이는 사진",
    "물 고임이나 넘침 흔적의 위치를 전달할 수 있어요.",
  ],
  before: [
    "입주 당시 같은 위치의 사진이나 점검표",
    "현재 손상과 입주 당시 상태를 비교할 수 있어요. 자료가 있다면 준비해 주세요.",
  ],
} as const;
const viewSchema = z.enum(
  Object.keys(views) as [keyof typeof views, ...(keyof typeof views)[]],
);
export type PhotoView = z.infer<typeof viewSchema>;
export const photoViewLabels: Record<PhotoView, string> = {
  overview: "전체 사진",
  closeup: "근접 사진",
  display: "오류 표시 사진",
  label: "제조연월 사진",
  drain: "배수구 주변 사진",
  before: "입주 당시 사진·점검표",
};
const locationSchema = z.enum(
  Object.keys(locations) as [
    keyof typeof locations,
    ...(keyof typeof locations)[],
  ],
);

export const photoDeviceSchema = z
  .object({
    detectedErrorCode: z
      .string()
      .regex(/^(?:[A-Z]{1,3}[- ]?[0-9]{1,3}|[0-9]{1,3}|[0-9]{1,2}[A-Z])$/)
      .nullable(),
    detectedManufactureYear: z.number().int().min(1900).max(2099).nullable(),
  })
  .strict();
export type PhotoDevice = z.infer<typeof photoDeviceSchema>;

// Provider output uses labels selected from an allowlist. Unrestricted OCR
// and free text never become an observation, retrieval input or saved record.
export const photoReadingSchema = z
  .object({
    readings: z
      .array(
        z
          .object({
            relevant: z.boolean(),
            clear: z.boolean(),
            signs: z.array(photoSignSchema).max(6),
            locations: z.array(locationSchema).max(3),
            views: z.array(viewSchema.exclude(["before"])).max(5),
            displayIsError: z.boolean(),
            labelIsManufactureDate: z.boolean(),
            detectedErrorCode: z.string().max(32).nullable(),
            detectedManufactureYear: z.number().int().nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();

const observationSchema = photoDeviceSchema.extend({
  status: z.enum(["observed", "unclear", "unrelated"]),
  signs: z.array(photoSignSchema).max(6),
  visualSummary: z.string().min(1).max(260),
});
export type PhotoObservation = z.infer<typeof observationSchema>;
export const photoResultSchema = z.object({
  status: z.enum(["analyzed", "unclear", "failed", "skipped", "mock"]),
  source: z.enum(["openai", "mock", "none"]).optional(),
  signs: z.array(photoSignSchema).max(6),
  count: z.number().int().min(1).max(3),
  observations: z.array(observationSchema).min(1).max(3).optional(),
  missingPhotoGuide: z.array(viewSchema).max(3).optional(),
  coveredViews: z.array(viewSchema).max(6).optional(),
  userConfirmed: photoDeviceSchema.optional(),
  retryAttempted: z.literal(true).optional(),
});
export type PhotoResult = z.infer<typeof photoResultSchema>;
export const photoInputSchema = z
  .string()
  .max(400000)
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/);
export const photoUploadSchema = z
  .object({
    consent: z.literal(true),
    images: z.array(photoInputSchema).min(1).max(3),
    covered: z.array(viewSchema).max(6).optional(),
  })
  .strict();
export type PhotoUpload = z.infer<typeof photoUploadSchema>;
export const photoFollowupSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("retry"), analysisId: z.string().uuid() })
    .strict(),
  z
    .object({
      action: z.literal("confirm"),
      analysisId: z.string().uuid(),
      device: photoDeviceSchema,
    })
    .strict(),
]);
export type PhotoFollowup = z.infer<typeof photoFollowupSchema>;

export const photoViewsByIssue: Record<Issue, PhotoView[]> = {
  mold: ["overview", "closeup"],
  leak: ["overview", "closeup"],
  boiler: ["display", "label", "overview"],
  fixture: ["overview", "display", "label"],
  surface: ["overview", "closeup", "before"],
  drain: ["drain", "overview"],
};
export function photoGuidance(keys: PhotoView[]) {
  return keys.map((key) => ({
    key,
    title: views[key][0],
    reason: views[key][1],
  }));
}
export function supportsPhotoDeviceDetails(
  input: Pick<Intake, "issue" | "observation">,
) {
  return (
    input.issue === "boiler" ||
    (input.issue === "fixture" &&
      !isLightingIssue(input) &&
      !["cabinet", "bed"].includes(input.observation))
  );
}
export function missingPhotoViews(
  input: Pick<Intake, "issue" | "drain" | "observation">,
  covered: PhotoView[] = [],
) {
  if (input.issue === "drain" && input.drain?.overflow === "yes") return [];
  const choices =
    input.issue === "fixture" && !supportsPhotoDeviceDetails(input)
      ? (["overview", "closeup"] as const)
      : photoViewsByIssue[input.issue];
  return choices.filter((key) => !covered.includes(key)).slice(0, 3);
}

const descriptions: Record<Sign, string> = {
  discoloration: "변색이나 얼룩",
  dark_spots: "검은 반점 형태의 얼룩",
  standing_water: "고여 있는 물",
  visible_debris: "이물질로 보이는 흔적",
  tear: "찢어지거나 들뜬 부분",
  dent_crack: "찍히거나 갈라진 부분",
  water_trace: "물자국 또는 젖은 흔적",
  appliance_damage: "겉면이 손상된 부분",
  fire_smoke: "불꽃이나 연기로 의심되는 흔적",
  exposed_wiring: "배선이 노출되거나 손상된 것으로 보이는 부분",
};
export function describePhoto(
  signs: Sign[],
  places: (keyof typeof locations)[],
  viewsSeen: PhotoView[],
) {
  const location = [...new Set(places)]
    .filter((p) => p !== "unknown")
    .map((p) => locations[p])
    .slice(0, 2)
    .join(" 및 ");
  if (signs.length)
    return `${location || "사진 속 문제 부위"}에서 ${signs
      .slice(0, 3)
      .map((s) => descriptions[s])
      .join(", ")} 같은 특징이 보여요.`;
  if (viewsSeen.includes("display"))
    return "기기 화면이 보이지만 오류의 원인이나 작동 상태는 확인할 수 없어요.";
  if (viewsSeen.includes("label"))
    return "기기 라벨이 보이지만 설치 시기나 수리 이력은 확인할 수 없어요.";
  return location
    ? `${location} 부분이 보이며 뚜렷한 손상 징후는 구분하기 어려워요.`
    : "이 사진에서 뚜렷한 문제 징후를 구분하기 어려워요.";
}
export function photoContext(photo?: PhotoResult) {
  return photo?.status === "analyzed" && photo.source !== "mock"
    ? photo.signs.map((s) => photoSigns[s]).join(" · ")
    : "";
}
export function photoDanger(photo?: PhotoResult) {
  return (
    photo?.status === "analyzed" &&
    (photo.signs.includes("fire_smoke") ||
      photo.signs.includes("exposed_wiring"))
  );
}

export function photoClarification(input: Intake, photo?: PhotoResult) {
  if (photo?.source !== "openai" || photo.status !== "analyzed") return null;
  if (
    input.issue === "drain" &&
    photo.signs.includes("standing_water") &&
    (!input.drain || input.drain.scope === "unknown")
  )
    return "물이 고인 곳 말고 다른 배수구도 같은 증상인지, 이미 본 범위만 확인해 주세요.";
  if (
    input.issue === "leak" &&
    photo.signs.includes("water_trace") &&
    input.observation !== "rain"
  )
    return "물자국이 비가 올 때나 물을 쓸 때 다시 생겼는지, 기억나는 시점을 확인해 주세요.";
  if (
    input.issue === "surface" &&
    photo.signs.some((sign) => sign === "tear" || sign === "dent_crack") &&
    input.preexisting === "unknown"
  )
    return "입주 때 같은 위치에 손상이 있었는지 사진이나 점검표가 있으면 확인해 주세요.";
  if (
    input.issue === "mold" &&
    photo.signs.includes("dark_spots") &&
    input.discovered === "unknown"
  )
    return "반점을 처음 본 때와 범위가 달라진 시점을 확인해 주세요.";
  return null;
}
