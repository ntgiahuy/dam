import { normalizeLapMultiple } from "./calc";
import { normalizeSpanStirrups, syncGeometry } from "./sample";
import type { BeamProject, ExtraBar, EndType, MainBar } from "./types";

export const SHOP_DAM_KIND = "giahuy-shop-dam";
export const SHOP_DAM_FILENAME = "[Giahuy.net]-shop_dam.json";

export interface ShopDamFile {
  kind: typeof SHOP_DAM_KIND;
  version: 1;
  savedAt: string;
  project: BeamProject;
}

function migrateV2EndType(t: number): EndType {
  if (t === 0) return 3;
  if (t === 1) return 2;
  if (t === 2) return 1;
  if (t === 3) return 4;
  if (t === 4) return 4;
  return 2;
}

export function migrateLoadedProject(raw: BeamProject, fromV2: boolean): BeamProject {
  const map = fromV2
    ? migrateV2EndType
    : (t: number) => (t === 1 || t === 2 || t === 3 || t === 4 ? t : 2);
  const fix = (b: ExtraBar): ExtraBar => ({
    ...b,
    startType: map(b.startType) as EndType,
    endType: map(b.endType) as EndType,
  });
  const enableCut = (b: MainBar): MainBar => ({
    ...b,
    autoCut: true,
    lapMultiple: normalizeLapMultiple(b.lapMultiple),
  });
  return {
    ...raw,
    mainBottom: (raw.mainBottom ?? []).map(enableCut),
    mainTop: (raw.mainTop ?? []).map(enableCut),
    extraBottom: (raw.extraBottom ?? []).map(fix),
    extraTop: (raw.extraTop ?? []).map((b) => {
      const x = fix(b);
      return {
        ...x,
        startType: (x.startType === 1 ? 1 : 2) as EndType,
        endType: (x.endType === 1 ? 1 : 2) as EndType,
      };
    }),
    stirrups: (raw.stirrups ?? []).map(normalizeSpanStirrups),
    secondary: raw.secondary ?? [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function looksLikeProject(value: unknown): value is BeamProject {
  if (!isRecord(value)) return false;
  if (!isRecord(value.info)) return false;
  if (!Array.isArray(value.spans) || value.spans.length < 1) return false;
  if (!Array.isArray(value.supports)) return false;
  return true;
}

export function serializeProjectFile(project: BeamProject): string {
  const file: ShopDamFile = {
    kind: SHOP_DAM_KIND,
    version: 1,
    savedAt: new Date().toISOString(),
    project,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseProjectFile(raw: unknown): BeamProject {
  if (!isRecord(raw)) {
    throw new Error("File không phải JSON dự án shop dầm.");
  }
  const candidate =
    raw.kind === SHOP_DAM_KIND && isRecord(raw.project) ? raw.project : raw;
  if (!looksLikeProject(candidate)) {
    throw new Error("File không phải [Giahuy.net]-shop_dam.json.");
  }
  const migrated = migrateLoadedProject(candidate, false);
  return syncGeometry(migrated, migrated.spans.length);
}

export function downloadProjectFile(project: BeamProject) {
  const blob = new Blob([serializeProjectFile(project)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = SHOP_DAM_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
