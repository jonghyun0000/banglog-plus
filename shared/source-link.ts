/** Repair the retired article popup URL without modifying approved source records.
 * Version 284415 is Civil Act effective 2026-03-17 (Act 21454).
 * Official full-text destination verified in a fresh browser on 2026-11-17.
 */
export function sourceLink(value: string): string {
  try {
    const url = new URL(value);
    if (
      url.hostname !== "www.law.go.kr" ||
      !["https:", "http:"].includes(url.protocol) ||
      url.pathname !== "/LSW/lsSideInfoP.do" ||
      url.searchParams.get("lsiSeq") !== "284415"
    )
      return value;
    const article = url.searchParams.get("joNo");
    const branch = url.searchParams.get("joBrNo") ?? "00";
    if (
      !article ||
      !/^\d{4}$/.test(article) ||
      !/^\d{2}$/.test(branch) ||
      Number(article) === 0
    )
      return value;
    return `https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284415#J${Number(article)}:${Number(branch)}`;
  } catch {
    return value;
  }
}
