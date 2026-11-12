// Identity fields stay in the editor's memory and are never part of saved/API data.
export function personalizeMessage(
  text: string,
  name: string,
  unit: string,
  language: "ko" | "en" = "ko",
) {
  const clean = (value: string) => value.replace(/[\r\n\t]/g, " ").trim();
  const who = clean(name).slice(0, 30);
  const room = clean(unit).slice(0, 30);
  if (!who && !room) return text;
  if (language === "en") {
    const intro = who
      ? `I’m ${who}${room ? ` from ${room}` : ""}.`
      : `I’m the tenant in ${room}.`;
    return `Hello. ${intro}\n${text.replace(/^Hello[,.!]?\s*/iu, "")}`;
  }
  const introduction = room
    ? `${room}에 거주하는 ${who || "세입자"}입니다.`
    : `세입자 ${who}입니다.`;
  const greeting = /^안녕하세요[.!]?\s*/u;
  return `안녕하세요. ${introduction}\n${text.replace(greeting, "")}`;
}
