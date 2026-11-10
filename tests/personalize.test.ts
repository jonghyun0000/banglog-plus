import { expect, it } from "vitest";
import { personalizeMessage } from "../src/features/message/personalize.js";
it.each([
  ["", "", "안녕하세요. 점검 부탁드립니다."],
  ["민수", "", "안녕하세요. 세입자 민수입니다.\n점검 부탁드립니다."],
  [
    "",
    "302호",
    "안녕하세요. 302호에 거주하는 세입자입니다.\n점검 부탁드립니다.",
  ],
  [
    "민수",
    "302호",
    "안녕하세요. 302호에 거주하는 민수입니다.\n점검 부탁드립니다.",
  ],
])("optional sender: %s %s", (name, unit, expected) => {
  expect(personalizeMessage("안녕하세요. 점검 부탁드립니다.", name, unit)).toBe(
    expected,
  );
});
