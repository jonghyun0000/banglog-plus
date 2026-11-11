import { repairSchema, type RepairRecord } from "../../../shared/repair";
const DB = "banglog-plus-repair-v1";
async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("records", { keyPath: "id" });
      r.result.createObjectStore("files");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (tx: IDBTransaction, set: (value: T) => void) => void,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    let value: T;
    const tx = db.transaction(["records", "files"], mode);
    tx.oncomplete = () => {
      db.close();
      resolve(value);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || Error("저장 실패"));
    };
    try {
      action(tx, (v) => (value = v));
    } catch {
      tx.abort();
    }
  });
}
export const listRepairs = () =>
  transaction<RepairRecord[]>("readonly", (tx, set) => {
    const r = tx.objectStore("records").getAll();
    r.onsuccess = () => {
      try {
        set(r.result.map((v) => repairSchema.parse(v)));
      } catch {
        tx.abort();
      }
    };
  });
export const saveRepair = (
  record: RepairRecord,
  files: Map<string, Blob>,
  removed: string[] = [],
) =>
  transaction<void>("readwrite", (tx) => {
    tx.objectStore("records").put(repairSchema.parse(record));
    for (const [id, file] of files) tx.objectStore("files").put(file, id);
    for (const id of removed) tx.objectStore("files").delete(id);
  });
export const getRepairFile = (id: string) =>
  transaction<Blob | undefined>("readonly", (tx, set) => {
    const r = tx.objectStore("files").get(id);
    r.onsuccess = () => set(r.result);
  });
export const deleteRepair = (r: RepairRecord) =>
  transaction<void>("readwrite", (tx) => {
    tx.objectStore("records").delete(r.id);
    for (const a of r.attachments) tx.objectStore("files").delete(a.id);
  });
export function validateFile(f: File) {
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "application/pdf",
    ].includes(f.type)
  )
    throw Error(
      "사진(JPEG·PNG·WebP), 영상(MP4·MOV·WebM), PDF만 첨부할 수 있어요.",
    );
  if (f.size > 20 * 1024 * 1024 || !f.size)
    throw Error("파일은 0바이트보다 크고 20MB 이하여야 해요.");
}
