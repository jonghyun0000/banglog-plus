import { describe, expect, it } from "vitest";
import { sourceLink } from "../shared/source-link";
const old =
  "https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0623&lsiSeq=284415&urlMode=lsScJoRltInfoR";
describe("official source display links", () => {
  it("opens the same Civil Act version using its full-text URL", () => {
    expect(sourceLink(old)).toBe(
      "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284415#J623:0",
    );
    expect(sourceLink(old.replace("0623", "0634"))).toContain("#J634:0");
    expect(sourceLink(old.replace("joBrNo=00", "joBrNo=02"))).toContain(
      "#J623:2",
    );
    expect(sourceLink(sourceLink(old))).toBe(sourceLink(old));
  });
  it("does not guess an unknown version, court case, other host or invalid article", () => {
    for (const value of [
      old.replace("284415", "123456"),
      old.replace("www.law.go.kr", "www.law.go.kr.example.com"),
      old.replace("0623", "abcd"),
      old.replace("0623", "0000"),
      "https://www.law.go.kr/LSW/precInfoP.do?precSeq=237925",
      "not a url",
    ])
      expect(sourceLink(value)).toBe(value);
  });
});
