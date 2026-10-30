import type { EggMode, PhotoEgg, SceneName } from "./worlds";

export type Look = "ACES" | "AgX" | "Neutral";
export type Lens = "deep" | "portrait" | "macro";
export type SavedProject = {
  /** 2 is a V2/V3 project (photos only); 3 adds the V4 egg placement; 4 adds the V5 look. All open. */
  version: 2 | 3 | 4;
  eggMode?: EggMode;
  /** V5: the camera move, the look (tone curve), the lens (depth of field), AO, grain, piece motion. */
  move?: string;
  look?: Look;
  lens?: Lens;
  ao?: boolean;
  grain?: number;
  spin?: boolean;
  float?: boolean;
  fps?: number;
  size?: number;
  savedAt: string;
  sceneName: SceneName;
  ratio: "1:1" | "9:16" | "16:9";
  duration: number;
  format: "GIF" | "VIDEO";
  photos: PhotoEgg[];
};

const DB_NAME = "spinlab-studio-v2";
const STORE = "projects";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalProject(project: SavedProject) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(project, "autosave");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadLocalProject(): Promise<SavedProject | null> {
  const db = await database();
  const result = await new Promise<SavedProject | null>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get("autosave");
    request.onsuccess = () => resolve((request.result as SavedProject | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
