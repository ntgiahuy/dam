"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus,
  FolderOpen,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Panel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BeamPreview } from "@/components/beam/BeamPreview";
import { SectionSketch } from "@/components/beam/SectionSketch";
import { SupportSketch } from "@/components/beam/SupportSketch";
import { StirrupSketch } from "@/components/beam/StirrupSketch";
import {
  applySpanParams,
  applySupportToAll,
  canShiftAxisRange,
  computeModel,
  defaultBottomMainHookMm,
  describeMainAutoCut,
  extrasForSpanSection,
  mainsQtyForSpan,
  normalizeLapMultiple,
  placeAxisRange,
  shiftAxisRange,
  stirrupZonesForSpan,
  syncSpanSupportGeometry,
} from "@/lib/calc";
import { ANTI_BUCKLING_DIAS, extraTieStatus, extraTiesHint, normalizeAntiBucklingDia } from "@/lib/extra-ties";
import { downloadPdf, generateBeamPdf } from "@/lib/pdf/generate";
import {
  migrateLoadedProject,
  parseProjectFile,
  saveProjectAsFile,
  SHOP_DAM_FILENAME,
} from "@/lib/project-file";
import { createEmptyProject, createSampleD1, defaultSpanStirrups, normalizeSpanStirrups, syncGeometry } from "@/lib/sample";
import type {
  BeamProject,
  ConnectionType,
  EndType,
  ExtraBar,
  LapMultiple,
  MainBar,
  SecondaryKind,
  ShearKind,
  SpanStirrups,
  StirrupLayout,
  TabId,
} from "@/lib/types";
import {
  DIAMETERS,
  LAP_MULTIPLES,
  extraEndTypeOptions,
  LAYER_LABELS,
  MAX_SPAN_COUNT,
  QTY_OPTIONS,
  SLAB_TYPES,
  STIRRUP_LAYOUTS,
  TABS,
  CONNECTION_TYPES,
} from "@/lib/types";
import { CONCRETE_GRADES, STEEL_GRADES } from "@/lib/tcvn5574";
import { uid } from "@/lib/utils";

const STORE_KEY = "thep-dam-project-v3";
const STORE_KEY_V2 = "thep-dam-project-v2";

function axisOptions(n: number) {
  return Array.from({ length: n + 1 }, (_, i) => i);
}

function mainAutoCutOn(bar: Pick<MainBar, "autoCut">) {
  return bar.autoCut !== false;
}

function barListLabel(b: MainBar) {
  const parts = [`${b.qty}Ø${b.dia}  (${b.startAxis}→${b.endAxis})`];
  if (b.hooksBothEnds) {
    const h =
      b.hookHeightMm && b.hookHeightMm > 0 ? b.hookHeightMm : defaultBottomMainHookMm(b.dia);
    parts.push(`móc ${h}`);
  }
  if (mainAutoCutOn(b)) parts.push(`cắt ${normalizeLapMultiple(b.lapMultiple)}D`);
  return parts.join(" · ");
}

function persistMainBar(bar: MainBar, face: "top" | "bottom"): MainBar {
  const autoCut = bar.autoCut !== false;
  const lapMultiple = normalizeLapMultiple(bar.lapMultiple);
  if (face === "top") {
    return {
      id: bar.id,
      dia: bar.dia,
      qty: bar.qty,
      startAxis: bar.startAxis,
      endAxis: bar.endAxis,
      autoCut,
      lapMultiple,
    };
  }
  const hooks = Boolean(bar.hooksBothEnds);
  const hookHeightMm = hooks
    ? bar.hookHeightMm && bar.hookHeightMm > 0
      ? bar.hookHeightMm
      : defaultBottomMainHookMm(bar.dia)
    : bar.hookHeightMm && bar.hookHeightMm > 0
      ? bar.hookHeightMm
      : undefined;
  return {
    ...bar,
    hooksBothEnds: hooks,
    hookHeightMm,
    autoCut,
    lapMultiple,
  };
}

/** Trùng dòng thép chủ: cùng số lượng, đường kính và đoạn trục. */
function mainBarDuplicate(bars: MainBar[], candidate: MainBar, exceptId?: string | null) {
  return bars.some(
    (b) =>
      b.id !== exceptId &&
      b.qty === candidate.qty &&
      b.dia === candidate.dia &&
      b.startAxis === candidate.startAxis &&
      b.endAxis === candidate.endAxis,
  );
}

function extraLabel(b: ExtraBar) {
  return `Lớp ${b.layer}: ${b.qty}Ø${b.dia}  (${b.startAxis}→${b.endAxis})`;
}

/** Trùng dòng danh sách: cùng lớp, số lượng, đường kính và đoạn trục. */
function extraBarDuplicate(bars: ExtraBar[], candidate: ExtraBar, exceptId?: string | null) {
  return bars.some(
    (b) =>
      b.id !== exceptId &&
      b.layer === candidate.layer &&
      b.qty === candidate.qty &&
      b.dia === candidate.dia &&
      b.startAxis === candidate.startAxis &&
      b.endAxis === candidate.endAxis,
  );
}

/** Thép mũ: một gối (0→0, 1→1, …). */
function extraTopAtSupport(axis: number, lastAxis: number) {
  const a = Math.max(0, Math.min(axis, lastAxis));
  return { startAxis: a, endAxis: a };
}

/** Thép bụng: một nhịp (0→1, 1→2, …). */
function extraBottomAtSpan(spanIndex: number, lastAxis: number) {
  const lastSpan = Math.max(0, lastAxis - 1);
  const s = Math.max(0, Math.min(spanIndex, lastSpan));
  return { startAxis: s, endAxis: s + 1 };
}

export function BeamApp() {
  const [project, setProject] = useState<BeamProject>(() => createSampleD1());
  const [tab, setTab] = useState<TabId>("spans");
  const [selectedSpan, setSelectedSpan] = useState(0);
  const [selectedSupport, setSelectedSupport] = useState(0);
  const [selectedBar, setSelectedBar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lastAxis = project.spans.length;

  useEffect(() => {
    try {
      const raw3 = localStorage.getItem(STORE_KEY);
      if (raw3) {
        const next = migrateLoadedProject(JSON.parse(raw3) as BeamProject, false);
        setProject(next);
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
        return;
      }
      const raw2 = localStorage.getItem(STORE_KEY_V2);
      if (raw2) {
        const next = migrateLoadedProject(JSON.parse(raw2) as BeamProject, true);
        setProject(next);
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      }
    } catch {
      /* keep sample */
    }
  }, []);

  const persist = useCallback((next: BeamProject) => {
    setProject(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const span = project.spans[selectedSpan] ?? project.spans[0];
  const support = project.supports[selectedSupport] ?? project.supports[0];

  function selectSpan(i: number) {
    setSelectedSpan(i);
    setSelectedSupport(Math.max(0, Math.min(i, project.supports.length - 1)));
  }

  function selectSupport(i: number) {
    setSelectedSupport(i);
    if (i < project.spans.length) setSelectedSpan(i);
    else setSelectedSpan(Math.max(0, project.spans.length - 1));
  }

  function patchSpan(partial: Partial<typeof span>) {
    const spans = project.spans.map((s, i) => (i === selectedSpan ? { ...s, ...partial } : s));
    let next = { ...project, spans };
    if (partial.B !== undefined || partial.B1 !== undefined) {
      next = syncSpanSupportGeometry(next, selectedSpan, selectedSupport, {
        B: partial.B,
        B1: partial.B1,
      });
    }
    persist(next);
  }

  function patchSupport(partial: Partial<typeof support>) {
    const supports = project.supports.map((s, i) => (i === selectedSupport ? { ...s, ...partial } : s));
    let next = { ...project, supports };
    if (partial.B !== undefined || partial.B1 !== undefined) {
      next = syncSpanSupportGeometry(next, selectedSpan, selectedSupport, {
        B: partial.B,
        B1: partial.B1,
      });
    }
    persist(next);
  }

  function patchStirrup(partial: Partial<SpanStirrups>) {
    persist({
      ...project,
      stirrups: project.stirrups.map((s, i) =>
        i === selectedSpan ? { ...(s ?? defaultSpanStirrups()), ...partial } : s,
      ),
    });
  }

  async function exportPdf() {
    setBusy(true);
    setError(null);
    setStatus("Đang tạo bản vẽ PDF…");
    try {
      const fontRes = await Promise.all([
        fetch("/fonts/BeVietnamPro-Regular.ttf"),
        fetch("/fonts/BeVietnamPro-Bold.ttf"),
      ]);
      if (fontRes.some((r) => !r.ok)) {
        throw new Error("Không tải được font chữ cho PDF.");
      }
      const [regular, bold] = await Promise.all(fontRes.map((r) => r.arrayBuffer()));
      const bytes = await generateBeamPdf(workingProject, { regular, bold });
      downloadPdf(bytes, `KetCauDam_${project.info.name}.pdf`);
      setStatus("Đã xuất PDF — kiểm tra thư mục Tải xuống.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Không xuất được PDF.";
      console.error("Xuất PDF thất bại:", e);
      setError(message);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const draftMain = useCallback(
    (face: "top" | "bottom"): MainBar => ({
      id: uid("bar"),
      dia: 18,
      qty: 2,
      startAxis: 0,
      endAxis: lastAxis,
      hooksBothEnds: face === "bottom" ? false : undefined,
      autoCut: true,
      lapMultiple: 30,
    }),
    [lastAxis],
  );

  function applyOpenedProject(next: BeamProject) {
    persist(next);
    setSelectedSpan(0);
    setSelectedSupport(0);
    setSelectedBar(null);
    setMainForm(draftMain("bottom"));
    setTab("spans");
    setError(null);
  }

  async function saveProjectToDisk() {
    try {
      const result = await saveProjectAsFile(project);
      if (result === "cancelled") return;
      setError(null);
      setStatus(`Đã lưu ${SHOP_DAM_FILENAME}.`);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Không lưu được file JSON.");
    }
  }

  async function openProjectFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const next = parseProjectFile(JSON.parse(text) as unknown);
      applyOpenedProject(next);
      setStatus(`Đã mở ${file.name}.`);
    } catch {
      setStatus(null);
      setError(`Không đọc được file. Chọn ${SHOP_DAM_FILENAME}.`);
    }
  }

  const [mainForm, setMainForm] = useState<MainBar>(() => draftMain("bottom"));
  const [extraForm, setExtraForm] = useState<ExtraBar>(() => ({
    id: uid("ex"),
    layer: 1,
    dia: 20,
    qty: 2,
    startAxis: 0,
    endAxis: 1,
    startType: 1,
    endType: 1,
  }));

  const workingProject = useMemo(() => {
    let next = project;
    if (selectedBar && tab === "mainBottom") {
      next = {
        ...next,
        mainBottom: next.mainBottom.map((b) =>
          b.id === selectedBar ? persistMainBar({ ...mainForm, id: b.id }, "bottom") : b,
        ),
      };
    } else if (selectedBar && tab === "mainTop") {
      next = {
        ...next,
        mainTop: next.mainTop.map((b) =>
          b.id === selectedBar ? persistMainBar({ ...mainForm, id: b.id }, "top") : b,
        ),
      };
    }
    const lap = normalizeLapMultiple(
      mainForm.lapMultiple ??
        next.mainTop.find((b) => mainAutoCutOn(b))?.lapMultiple ??
        next.mainBottom.find((b) => mainAutoCutOn(b))?.lapMultiple,
    );
    return {
      ...next,
      mainTop: next.mainTop.map((b) =>
        persistMainBar({ ...b, autoCut: true, lapMultiple: b.lapMultiple ?? lap }, "top"),
      ),
      mainBottom: next.mainBottom.map((b) =>
        persistMainBar({ ...b, autoCut: true, lapMultiple: b.lapMultiple ?? lap }, "bottom"),
      ),
    };
  }, [project, selectedBar, tab, mainForm]);

  const model = useMemo(() => computeModel(workingProject), [workingProject]);

  useEffect(() => {
    if (tab === "extraTop") {
      setExtraForm((f) => {
        const startType = f.startType === 1 ? 1 : 2;
        const endType = f.endType === 1 ? 1 : 2;
        const pinned = extraTopAtSupport(f.startAxis, lastAxis);
        if (
          startType === f.startType &&
          endType === f.endType &&
          f.startAxis === pinned.startAxis &&
          f.endAxis === pinned.endAxis
        ) {
          return f;
        }
        return { ...f, startType, endType, ...pinned };
      });
      return;
    }
    if (tab === "extraBottom") {
      setExtraForm((f) => {
        const pinned = extraBottomAtSpan(Math.min(f.startAxis, f.endAxis), lastAxis);
        if (f.startAxis === pinned.startAxis && f.endAxis === pinned.endAxis) return f;
        return { ...f, ...pinned };
      });
    }
    if (tab === "mainBottom" || tab === "mainTop") {
      setMainForm((f) => {
        if (f.autoCut === true && f.lapMultiple) return f;
        return { ...f, autoCut: true, lapMultiple: normalizeLapMultiple(f.lapMultiple) };
      });
    }
  }, [tab, lastAxis]);

  const barRegion =
    tab === "extraBottom" || tab === "extraTop"
      ? extraForm
      : tab === "mainBottom" || tab === "mainTop"
        ? mainForm
        : null;
  const highlightStart = barRegion ? Math.min(barRegion.startAxis, barRegion.endAxis) : selectedSpan;
  const highlightEnd = barRegion ? Math.max(barRegion.startAxis, barRegion.endAxis) : selectedSpan + 1;

  function moveBarRegionToSpan(spanIndex: number) {
    selectSpan(spanIndex);
    if (tab === "extraTop") {
      setExtraForm((f) => ({ ...f, ...extraTopAtSupport(spanIndex, lastAxis) }));
      return;
    }
    if (tab === "extraBottom") {
      setExtraForm((f) => ({ ...f, ...extraBottomAtSpan(spanIndex, lastAxis) }));
      return;
    }
    if (tab === "mainBottom" || tab === "mainTop") {
      setMainForm({
        ...mainForm,
        ...placeAxisRange(mainForm.startAxis, mainForm.endAxis, spanIndex, lastAxis),
      });
    }
  }

  function addMain(key: "mainBottom" | "mainTop") {
    if (mainBarDuplicate(project[key], mainForm)) {
      setError(`Không thêm được: đã có ${barListLabel(mainForm)} trong danh sách.`);
      setStatus(null);
      return;
    }
    const bar = persistMainBar({ ...mainForm, id: uid("bar") }, key === "mainBottom" ? "bottom" : "top");
    persist({ ...project, [key]: [...project[key], bar] });
    setSelectedBar(bar.id);
    setError(null);
    setStatus(`Đã thêm ${barListLabel(bar)}.`);
  }
  function editMain(key: "mainBottom" | "mainTop") {
    if (!selectedBar) return;
    if (mainBarDuplicate(project[key], mainForm, selectedBar)) {
      setError(`Không lưu được: đã có ${barListLabel(mainForm)} trong danh sách.`);
      setStatus(null);
      return;
    }
    persist({
      ...project,
      [key]: project[key].map((b) =>
        b.id === selectedBar
          ? persistMainBar({ ...mainForm, id: b.id }, key === "mainBottom" ? "bottom" : "top")
          : b,
      ),
    });
    setError(null);
    setStatus(`Đã sửa ${barListLabel(mainForm)}.`);
  }
  function delMain(key: "mainBottom" | "mainTop") {
    persist({ ...project, [key]: project[key].filter((b) => b.id !== selectedBar) });
    setSelectedBar(null);
  }

  function addExtra(key: "extraBottom" | "extraTop") {
    const draft =
      key === "extraTop"
        ? { ...extraForm, ...extraTopAtSupport(extraForm.startAxis, lastAxis) }
        : { ...extraForm, ...extraBottomAtSpan(extraForm.startAxis, lastAxis) };
    if (extraBarDuplicate(project[key], draft)) {
      setError(`Không thêm được: đã có ${extraLabel(draft)} trong danh sách.`);
      setStatus(null);
      return;
    }
    const bar = { ...draft, id: uid("ex") };
    persist({ ...project, [key]: [...project[key], bar] });
    setError(null);
    if (key === "extraTop") {
      const nextAxis = bar.startAxis + 1;
      if (nextAxis <= lastAxis) {
        setSelectedBar(null);
        setExtraForm({ ...draft, id: uid("ex"), ...extraTopAtSupport(nextAxis, lastAxis) });
        setSelectedSupport(nextAxis);
        setSelectedSpan(Math.min(nextAxis, Math.max(0, project.spans.length - 1)));
        setStatus(`Đã thêm ${extraLabel(bar)}. Gối tiếp theo: ${nextAxis}→${nextAxis}.`);
      } else {
        setSelectedBar(bar.id);
        setStatus(`Đã thêm ${extraLabel(bar)} (gối cuối).`);
      }
      return;
    }
    const nextSpan = extraBottomAtSpan(bar.startAxis + 1, lastAxis);
    const moved = nextSpan.startAxis !== bar.startAxis;
    if (moved) {
      setSelectedBar(null);
      setExtraForm({ ...draft, id: uid("ex"), ...nextSpan });
      setSelectedSpan(nextSpan.startAxis);
      setSelectedSupport(nextSpan.startAxis);
      setStatus(
        `Đã thêm ${extraLabel(bar)}. Nhịp tiếp theo: ${nextSpan.startAxis}→${nextSpan.endAxis}.`,
      );
    } else {
      setSelectedBar(bar.id);
      setStatus(`Đã thêm ${extraLabel(bar)} (nhịp cuối).`);
    }
  }
  function editExtra(key: "extraBottom" | "extraTop") {
    if (!selectedBar) return;
    const draft =
      key === "extraTop"
        ? { ...extraForm, ...extraTopAtSupport(extraForm.startAxis, lastAxis) }
        : { ...extraForm, ...extraBottomAtSpan(extraForm.startAxis, lastAxis) };
    if (extraBarDuplicate(project[key], draft, selectedBar)) {
      setError(`Không lưu được: đã có ${extraLabel(draft)} trong danh sách.`);
      setStatus(null);
      return;
    }
    persist({
      ...project,
      [key]: project[key].map((b) => (b.id === selectedBar ? { ...draft, id: b.id } : b)),
    });
    setError(null);
    setStatus(`Đã sửa ${extraLabel(draft)}.`);
  }
  function delExtra(key: "extraBottom" | "extraTop") {
    persist({ ...project, [key]: project[key].filter((b) => b.id !== selectedBar) });
    setSelectedBar(null);
  }

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="mr-2 flex min-w-0 items-center gap-4">
          <a
            href="https://www.giahuy.net/"
            target="_blank"
            rel="noopener noreferrer"
            title="GiaHuy.Net"
            className="inline-flex shrink-0 items-center leading-none"
          >
            <img
              src="/giahuy-logo.png"
              alt="GiaHuy"
              width={171}
              height={47}
              className="h-10 w-auto sm:h-[44px]"
            />
          </a>
          <div className="min-w-0 border-l border-[#8b949e] pl-4">
            <div className="text-sm font-bold tracking-wide text-[#79b8ff] sm:text-base">
              Shop drawing thép dầm
            </div>
            <div className="text-[11px] leading-snug text-zinc-400">
              Nhập kích thước dầm, bấm nút xanh để xem bản vẽ. Tải PDF khi cần.
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              persist(createEmptyProject());
              setSelectedSpan(0);
              setSelectedSupport(0);
              setSelectedBar(null);
              setMainForm(draftMain("bottom"));
              setStatus("Đã tạo dầm mới.");
            }}
          >
            <FilePlus /> Mới
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              void openProjectFile(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <FolderOpen /> Open
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void saveProjectToDisk()}>
            <Save /> Save As
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={() => {
              persist(project);
              setStatus("Đã lưu trên trình duyệt.");
            }}
          >
            <Save /> Lưu
          </Button>
          <Button size="sm" disabled={busy} onClick={exportPdf}>
            <Download /> {busy ? "Đang xuất…" : "Xuất PDF"}
          </Button>
          {status && <span className="text-xs text-emerald-400">{status}</span>}
          {error && <span className="max-w-xs text-xs text-red-400">{error}</span>}
        </div>
      </header>

      <nav className="flex gap-0.5 overflow-x-auto border-b border-zinc-800 bg-zinc-900 px-2 py-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-tab={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-t px-2.5 py-1.5 text-[12px] ${
              tab === t.id
                ? "bg-zinc-800 text-sky-300 font-semibold"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(210px,280px)_minmax(0,1fr)] lg:grid-rows-[240px_minmax(0,1fr)]">
        <div className="overflow-auto border-b border-zinc-800 bg-zinc-900 p-3">
          {tab === "spans" && span && (
            <div className="flex flex-wrap gap-3">
              <Panel title="Số liệu nhịp dầm" className="flex-1 min-w-[280px]">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Field label="Số lượng nhịp dầm">
                    <Input
                      type="number"
                      min={1}
                      max={MAX_SPAN_COUNT}
                      value={project.spans.length}
                      onChange={(e) => persist(syncGeometry(project, Number(e.target.value) || 1))}
                    />
                  </Field>
                  <Field label="Chiều dài nhịp L (mm)">
                    <Input
                      type="number"
                      value={span.L}
                      onChange={(e) => patchSpan({ L: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Chiều cao dầm H (mm)">
                    <Input
                      type="number"
                      value={span.H}
                      onChange={(e) => patchSpan({ H: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Chiều rộng dầm B (mm)">
                    <Input
                      type="number"
                      value={span.B}
                      onChange={(e) => patchSpan({ B: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Lệch trục B1 (mm)">
                    <Input
                      type="number"
                      min={0}
                      value={span.B1}
                      onChange={(e) => patchSpan({ B1: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Lệch cao độ trên dầm (mm)">
                    <Input
                      type="number"
                      value={span.dH}
                      onChange={(e) => patchSpan({ dH: Number(e.target.value) || 0 })}
                    />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-500">Nhịp đang chọn: {selectedSpan + 1}</span>
                  <span className="text-xs text-zinc-600">B và B1 dùng chung với gối đỡ.</span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      title="Nhịp tiếp theo"
                      onClick={() => selectSpan((selectedSpan + 1) % project.spans.length)}
                    >
                      <ChevronRight /> Tiếp theo
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => persist(applySpanParams(project, selectedSpan, ["L", "H", "B", "B1", "dH"]))}
                    >
                      <Check /> Áp dụng cho các nhịp
                    </Button>
                  </div>
                </div>
              </Panel>
              <SectionSketch span={span} />
            </div>
          )}

          {tab === "slab" && span && (
            <div className="flex flex-wrap gap-3">
              <Panel title="Thông số sàn" className="flex-1 min-w-[280px]">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Field label="Chọn dạng tiết diện">
                    <Select
                      value={span.slabType}
                      onChange={(e) => patchSpan({ slabType: Number(e.target.value) })}
                    >
                      {SLAB_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {(span.slabType === 1 || span.slabType === 2) && (
                    <>
                      <Field label="Chiều dày sàn HSL (mm)">
                        <Input
                          type="number"
                          min={0}
                          value={span.Hsl}
                          onChange={(e) => patchSpan({ Hsl: Number(e.target.value) || 0 })}
                        />
                      </Field>
                      <Field label="Lệch đỉnh dầm HL (mm)">
                        <Input
                          type="number"
                          min={0}
                          value={span.Hl}
                          onChange={(e) => patchSpan({ Hl: Number(e.target.value) || 0 })}
                        />
                      </Field>
                    </>
                  )}
                  {(span.slabType === 1 || span.slabType === 3) && (
                    <>
                      <Field label="Chiều dày sàn HSR (mm)">
                        <Input
                          type="number"
                          min={0}
                          value={span.Hsr}
                          onChange={(e) => patchSpan({ Hsr: Number(e.target.value) || 0 })}
                        />
                      </Field>
                      <Field label="Lệch đỉnh dầm HR (mm)">
                        <Input
                          type="number"
                          min={0}
                          value={span.Hr}
                          onChange={(e) => patchSpan({ Hr: Number(e.target.value) || 0 })}
                        />
                      </Field>
                    </>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-500">Nhịp đang chọn: {selectedSpan + 1}</span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      title="Nhịp tiếp theo"
                      onClick={() => selectSpan((selectedSpan + 1) % project.spans.length)}
                    >
                      <ChevronRight /> Tiếp theo
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() =>
                        persist(applySpanParams(project, selectedSpan, ["slabType", "Hsl", "Hl", "Hsr", "Hr"]))
                      }
                    >
                      <Check /> Áp dụng cho các nhịp
                    </Button>
                  </div>
                </div>
              </Panel>
              <SectionSketch span={span} />
            </div>
          )}

          {tab === "supports" && support && (
            <div className="flex flex-wrap gap-3">
              <Panel title="Thông số gối đỡ" className="flex-1 min-w-[320px]">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-[280px] flex-1 space-y-2">
                    <div className="text-[11px] text-sky-400">
                      Gối đang chọn: trục {support.axisName || selectedSupport}
                    </div>
                    <label className="flex items-center gap-2">
                      <span className="w-52 shrink-0 text-[12px] text-zinc-300">- Chọn liên kết</span>
                      <Select
                        className="max-w-[200px]"
                        value={support.type}
                        onChange={(e) => patchSupport({ type: e.target.value as ConnectionType })}
                      >
                        {CONNECTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="w-52 shrink-0 text-[12px] text-zinc-300">- Chiều rộng gối B (mm)</span>
                      <Input
                        className="max-w-[200px]"
                        type="number"
                        value={support.B}
                        onChange={(e) => patchSupport({ B: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="w-52 shrink-0 text-[12px] text-zinc-300">- Khoảng gối lệch trục B1 (mm)</span>
                      <Input
                        className="max-w-[200px]"
                        type="number"
                        min={0}
                        value={support.B1}
                        onChange={(e) => patchSupport({ B1: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <p className="-mt-1 pl-[13.5rem] text-[11px] text-zinc-500">
                      Từ mép trái gối đến tim trục. 0 = tim trùng mép trái, B/2 = cân giữa.
                    </p>
                    <label className="flex items-center gap-2">
                      <span className="w-52 shrink-0 text-[12px] text-zinc-300">- Chiều cao gối H (mm)</span>
                      <Input
                        className="max-w-[200px]"
                        type="number"
                        value={support.H || ""}
                        onChange={(e) => patchSupport({ H: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="w-52 shrink-0 text-[12px] text-zinc-300">- Tên trục định vị gối</span>
                      <Input
                        className="max-w-[160px]"
                        value={support.axisName}
                        onChange={(e) => patchSupport({ axisName: e.target.value })}
                      />
                      <Button
                        variant="success"
                        size="icon"
                        title="Gối tiếp theo"
                        onClick={() => {
                          const next = (selectedSupport + 1) % project.supports.length;
                          selectSupport(next);
                        }}
                      >
                        <ChevronRight />
                      </Button>
                    </label>
                    <div className="pt-1">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => persist(applySupportToAll(project, selectedSupport))}
                      >
                        <Check /> Áp dụng cho các nhịp
                      </Button>
                      <p className="mt-1 text-[11px] text-zinc-600">B và B1 dùng chung với số liệu nhịp dầm.</p>
                    </div>
                  </div>
                  <SupportSketch B={support.B} B1={support.B1} />
                </div>
              </Panel>
            </div>
          )}

          {(tab === "mainBottom" || tab === "mainTop") && (
            <MainBarPanel
              title={tab === "mainBottom" ? "Thông số thép chủ lớp dưới" : "Thông số thép chủ lớp trên"}
              bars={tab === "mainBottom" ? project.mainBottom : project.mainTop}
              form={mainForm}
              setForm={setMainForm}
              selected={selectedBar}
              onSelect={(b) => {
                const face = tab === "mainTop" ? "top" : "bottom";
                setSelectedBar(b.id);
                setMainForm(persistMainBar({ ...b, autoCut: true }, face));
              }}
              lastAxis={lastAxis}
              onAdd={() => addMain(tab === "mainBottom" ? "mainBottom" : "mainTop")}
              onEdit={() => editMain(tab === "mainBottom" ? "mainBottom" : "mainTop")}
              onDelete={() => delMain(tab === "mainBottom" ? "mainBottom" : "mainTop")}
              showBothEndHooks={tab === "mainBottom"}
              showAutoCut
              spliceFace={tab === "mainTop" ? "top" : "bottom"}
              autoCutHint={describeMainAutoCut(
                project,
                mainForm,
                tab === "mainTop" ? "top" : "bottom",
              )}
              onAutoCutChange={(autoCut, lapMultiple) => {
                const key = tab === "mainTop" ? "mainTop" : "mainBottom";
                const face = key === "mainTop" ? "top" : "bottom";
                persist({
                  ...project,
                  [key]: project[key].map((b) => persistMainBar({ ...b, autoCut, lapMultiple }, face)),
                });
              }}
              onRegionMove={(start, end) => {
                selectSpan(Math.min(Math.min(start, end), Math.max(0, project.spans.length - 1)));
                void end;
              }}
            />
          )}

          {(tab === "extraBottom" || tab === "extraTop") && (
            <ExtraBarPanel
              title={
                tab === "extraBottom"
                  ? "Thông số thép bổ sung lớp dưới"
                  : "Thông số thép bổ sung lớp trên"
              }
              bars={tab === "extraBottom" ? project.extraBottom : project.extraTop}
              form={extraForm}
              setForm={setExtraForm}
              selected={selectedBar}
              onSelect={(b) => {
                setSelectedBar(b.id);
                if (tab === "extraTop") {
                  const pinned = extraTopAtSupport(b.startAxis, lastAxis);
                  setExtraForm({ ...b, ...pinned });
                  setSelectedSupport(pinned.startAxis);
                  setSelectedSpan(Math.min(pinned.startAxis, Math.max(0, project.spans.length - 1)));
                } else {
                  const pinned = extraBottomAtSpan(b.startAxis, lastAxis);
                  setExtraForm({ ...b, ...pinned });
                  setSelectedSpan(pinned.startAxis);
                  setSelectedSupport(pinned.startAxis);
                }
              }}
              lastAxis={lastAxis}
              onAdd={() => addExtra(tab === "extraBottom" ? "extraBottom" : "extraTop")}
              onEdit={() => editExtra(tab === "extraBottom" ? "extraBottom" : "extraTop")}
              onDelete={() => delExtra(tab === "extraBottom" ? "extraBottom" : "extraTop")}
              onRegionMove={(start, end) => {
                const axis = Math.min(start, end);
                selectSpan(Math.min(axis, Math.max(0, project.spans.length - 1)));
                if (tab === "extraTop") setSelectedSupport(axis);
              }}
              face={tab === "extraTop" ? "top" : "bottom"}
            />
          )}

          {tab === "stirrups" && (
            <div className="flex flex-wrap gap-3">
              <div className="flex min-w-[280px] flex-1 flex-col gap-3">
              <Panel title="Thông số thép đai">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  <Field label="Đường kính đai">
                    <Select
                      value={project.stirrups[selectedSpan]?.dia ?? 6}
                      onChange={(e) => patchStirrup({ dia: Number(e.target.value) })}
                    >
                      {DIAMETERS.filter((d) => d <= 12).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Cách bố trí đai">
                    <Select
                      value={project.stirrups[selectedSpan]?.layout === "dieu" ? "dieu" : "1/4"}
                      onChange={(e) => patchStirrup({ layout: e.target.value as StirrupLayout })}
                    >
                      {STIRRUP_LAYOUTS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {project.stirrups[selectedSpan]?.layout === "dieu" ? (
                    <Field label="Khoảng cách đai (mm)">
                      <Input
                        type="number"
                        min={50}
                        value={project.stirrups[selectedSpan]?.a1 ?? 150}
                        onChange={(e) => patchStirrup({ a1: Number(e.target.value) || 0 })}
                      />
                    </Field>
                  ) : (
                    <>
                      <Field label="Khoảng cách đai A1 (mm)">
                        <Input
                          type="number"
                          min={50}
                          value={project.stirrups[selectedSpan]?.a1 ?? 150}
                          onChange={(e) => patchStirrup({ a1: Number(e.target.value) || 0 })}
                        />
                      </Field>
                      <Field label="Khoảng cách đai A2 (mm)">
                        <Input
                          type="number"
                          min={50}
                          value={project.stirrups[selectedSpan]?.a2 ?? 200}
                          onChange={(e) => patchStirrup({ a2: Number(e.target.value) || 0 })}
                        />
                      </Field>
                    </>
                  )}
                </div>
                {(() => {
                  const z = stirrupZonesForSpan(project, selectedSpan);
                  if (z.layout === "dieu") {
                    return (
                      <p className="mt-2 text-[11px] leading-snug text-zinc-400">
                        Nhịp {selectedSpan + 1}: đai điều từ gối đến gối, {z.mid.length} mm ({z.mid.count}Ø{z.dia}a
                        {z.mid.spacing}) — một khoảng trên cả nhịp.
                      </p>
                    );
                  }
                  return (
                    <p className="mt-2 text-[11px] leading-snug text-zinc-400">
                      Nhịp {selectedSpan + 1}: gối trái {z.left.length} mm ({z.left.count}Ø{z.dia}a{z.left.spacing})
                      · giữa {z.mid.length} mm ({z.mid.count}Ø{z.dia}a{z.mid.spacing}) · gối phải {z.right.length} mm
                      ({z.right.count}Ø{z.dia}a{z.right.spacing}). Chiều dài vùng gối = thép tăng cường M- (không có
                      thì l₀/4).
                    </p>
                  );
                })()}
                <Button
                  className="mt-3"
                  variant="success"
                  size="sm"
                  onClick={() => {
                    const src = project.stirrups[selectedSpan] ?? defaultSpanStirrups();
                    persist({
                      ...project,
                      stirrups: project.stirrups.map(() => ({ ...src })),
                    });
                    setStatus("Đã áp dụng đai cho mọi nhịp.");
                  }}
                >
                  <Check /> Áp dụng cho các nhịp
                </Button>
              </Panel>
              {(() => {
                  const src = project.stirrups[selectedSpan] ?? defaultSpanStirrups();
                  const antiOn = Boolean(src.antiBuckling);
                  const st = extraTieStatus(
                    {
                      ...project,
                      stirrups: project.stirrups.map((s, i) =>
                        i === selectedSpan ? { ...s, antiBuckling: antiOn } : s,
                      ),
                    },
                    selectedSpan,
                  );
                  const extraC = (Boolean(src.extraC) || antiOn) && st.allowC;
                  const extraNested = Boolean(src.extraNested) && !Boolean(src.extraDouble) && st.allowInner;
                  const extraDouble = Boolean(src.extraDouble) && !Boolean(src.extraNested) && st.allowInner;
                  const hint = extraTiesHint({
                    ...project,
                    stirrups: project.stirrups.map((s, i) =>
                      i === selectedSpan
                        ? { ...s, extraC, extraNested, extraDouble, antiBuckling: antiOn }
                        : s,
                    ),
                  });
                  const box = (
                    key: "extraC" | "extraNested" | "extraDouble",
                    label: string,
                    allowed: boolean,
                    checked: boolean,
                  ) => (
                    <label
                      key={key}
                      className={`inline-flex shrink-0 items-center gap-2 text-sm ${
                        allowed || checked ? "cursor-pointer text-zinc-200" : "cursor-not-allowed text-zinc-500"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!allowed}
                        onCheckedChange={(value) => {
                          if (!allowed) return;
                          const on = value === true;
                          if (key === "extraNested") {
                            patchStirrup({ extraNested: on, extraDouble: on ? false : src.extraDouble });
                            return;
                          }
                          if (key === "extraDouble") {
                            patchStirrup({ extraDouble: on, extraNested: on ? false : src.extraNested });
                            return;
                          }
                          if (antiOn && !on) return;
                          patchStirrup({ extraC: on });
                        }}
                      />
                      {label}
                    </label>
                  );
                  const disableNote = !st.allowC && !antiOn
                    ? st.cHint
                    : extraDouble
                      ? "Đã chọn đai kép — không dùng đai lồng."
                      : extraNested
                        ? "Đã chọn đai lồng — không dùng đai kép."
                        : !st.allowInner
                          ? st.innerHint
                          : null;
                  return (
                    <Panel title="Thép bổ sung">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        {box("extraC", "Đai C", st.allowC && !antiOn, extraC)}
                        {box("extraNested", "Đai lồng", st.allowInner && !extraDouble, extraNested)}
                        {box("extraDouble", "Đai kép", st.allowInner && !extraNested, extraDouble)}
                        <label className="inline-flex shrink-0 items-center gap-2 text-sm text-zinc-200">
                          <Checkbox
                            checked={antiOn}
                            onCheckedChange={(value) => {
                              const on = value === true;
                              patchStirrup({
                                antiBuckling: on,
                                extraC: on ? true : src.extraC,
                                antiBucklingDia: normalizeAntiBucklingDia(src.antiBucklingDia),
                              });
                            }}
                          />
                          Thép chống phình
                        </label>
                        {antiOn ? (
                          <Field label="Ø chống phình" className="w-[88px]">
                            <Select
                              value={normalizeAntiBucklingDia(src.antiBucklingDia)}
                              onChange={(e) =>
                                patchStirrup({
                                  antiBuckling: true,
                                  extraC: true,
                                  antiBucklingDia: Number(e.target.value),
                                })
                              }
                            >
                              {ANTI_BUCKLING_DIAS.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        ) : null}
                      </div>
                      {extraDouble ? (
                        <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                          Đai kép bổ sung thay đai lồng — cùng khoảng đai chính, 2 thanh/vị trí (shop thép cột).
                        </p>
                      ) : null}
                      {disableNote ? (
                        <p className="mt-2 text-[11px] leading-snug text-zinc-500">{disableNote}</p>
                      ) : null}
                      {hint ? (
                        <p className="mt-2 text-[11px] leading-snug text-zinc-400">{hint}</p>
                      ) : (
                        <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                          Thép chống phình: 2 cây tại giữa H, mỗi bên đai 1 cây (Ø10–16). Tick sẽ bật đai C để
                          móc 2 cây này. Đai C = h₀ + 100; đai lồng/kép = 2·(b+h) + 100.
                        </p>
                      )}
                    </Panel>
                  );
                })()}
              </div>
              <StirrupSketch
                kind={project.stirrups[selectedSpan]?.kind ?? "don"}
                extraC={Boolean(project.stirrups[selectedSpan]?.extraC)}
                extraNested={Boolean(project.stirrups[selectedSpan]?.extraNested)}
                extraDouble={Boolean(project.stirrups[selectedSpan]?.extraDouble)}
                antiBuckling={Boolean(project.stirrups[selectedSpan]?.antiBuckling)}
                B={span?.B ?? 200}
                H={span?.H ?? 500}
                cover={project.info.cover || 25}
                mainTopQty={mainsQtyForSpan(project.mainTop, selectedSpan, "top") || 2}
                mainBottomQty={mainsQtyForSpan(project.mainBottom, selectedSpan, "bottom") || 2}
                extraTop={extrasForSpanSection(project.extraTop, selectedSpan, "top")}
                extraBottom={extrasForSpanSection(project.extraBottom, selectedSpan, "bottom")}
              />
            </div>
          )}

          {tab === "secondary" && (
            <SecondaryPanel project={project} persist={persist} />
          )}

          {tab === "info" && (
            <Panel title="Thông tin dầm" className="max-w-xl">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tên dầm">
                  <Input
                    value={project.info.name}
                    onChange={(e) => persist({ ...project, info: { ...project.info, name: e.target.value } })}
                  />
                </Field>
                <Field label="Số lượng dầm">
                  <Input
                    type="number"
                    min={1}
                    value={project.info.quantity}
                    onChange={(e) =>
                      persist({
                        ...project,
                        info: { ...project.info, quantity: Number(e.target.value) || 1 },
                      })
                    }
                  />
                </Field>
                <Field label="Cao độ dầm (m)">
                  <Input
                    type="number"
                    step={0.001}
                    value={project.info.elevation}
                    onChange={(e) =>
                      persist({
                        ...project,
                        info: { ...project.info, elevation: Number(e.target.value) || 0 },
                      })
                    }
                  />
                </Field>
                <Field label="Trục định vị">
                  <Input
                    value={project.info.axisName}
                    onChange={(e) =>
                      persist({ ...project, info: { ...project.info, axisName: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Lớp bảo vệ đai (mm)">
                  <Input
                    type="number"
                    value={project.info.cover}
                    onChange={(e) =>
                      persist({
                        ...project,
                        info: { ...project.info, cover: Number(e.target.value) || 25 },
                      })
                    }
                  />
                  <p className="text-[10px] leading-tight text-zinc-500">
                    Cho đai và khoảng cách thép dọc tới mặt trên/dưới. Đầu biên dầm: thép dọc lùi 50 mm mỗi mép ngoài.
                  </p>
                </Field>
                <Field label="Cấp bê tông (TCVN 5574:2018)">
                  <Select
                    value={project.info.concreteGrade || "B25"}
                    onChange={(e) =>
                      persist({ ...project, info: { ...project.info, concreteGrade: e.target.value } })
                    }
                  >
                    {CONCRETE_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Loại thép (TCVN 5574:2018)">
                  <Select
                    value={project.info.steelGrade || "CB400-V"}
                    onChange={(e) =>
                      persist({ ...project, info: { ...project.info, steelGrade: e.target.value } })
                    }
                  >
                    {STEEL_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button
                className="mt-3"
                variant="success"
                size="sm"
                onClick={() => {
                  persist(project);
                  setStatus("Đã lưu thông tin dầm.");
                }}
              >
                <Save /> Save
              </Button>
            </Panel>
          )}
        </div>

        <BeamPreview
          project={workingProject}
          tab={tab}
          selectedSpan={selectedSpan}
          selectedSupport={selectedSupport}
          highlightStart={highlightStart}
          highlightEnd={highlightEnd}
          extraDraft={tab === "extraBottom" || tab === "extraTop" ? extraForm : null}
          onSelectSpan={barRegion ? moveBarRegionToSpan : selectSpan}
          onSelectSupport={(i) => {
            selectSupport(i);
            if (tab === "extraTop") {
              setExtraForm((f) => ({ ...f, ...extraTopAtSupport(i, lastAxis) }));
            } else if (tab === "extraBottom") {
              setExtraForm((f) => ({ ...f, ...extraBottomAtSpan(i === lastAxis ? i - 1 : i, lastAxis) }));
            }
          }}
        />
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-400">
        <span>
          Thép: {model.byDia.map((d) => `Ø${d.dia} ${d.weight.toFixed(1)}kg`).join(" · ") || "—"}
        </span>
        <span>Tổng {model.totalWeight.toFixed(1)} kg · {project.info.quantity} cấu kiện</span>
        {status && <span className="text-emerald-400">{status}</span>}
        {error && <span className="text-red-400">{error}</span>}
        <span className="ml-auto text-zinc-600">Nhấp vào nhịp / gối trên bản vẽ để chọn</span>
      </footer>
    </div>
  );
}

function CrudButtons({
  onAdd,
  onEdit,
  onDelete,
  onShiftLeft,
  onShiftRight,
  canShiftLeft,
  canShiftRight,
  rangeLabel,
  addDisabled,
  editDisabled,
  addTitle,
  editTitle,
}: {
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShiftLeft?: () => void;
  onShiftRight?: () => void;
  canShiftLeft?: boolean;
  canShiftRight?: boolean;
  rangeLabel?: string;
  addDisabled?: boolean;
  editDisabled?: boolean;
  addTitle?: string;
  editTitle?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="success" size="sm" disabled={addDisabled} title={addTitle} onClick={onAdd}>
        <Plus /> Thêm
      </Button>
      {onShiftLeft && onShiftRight && (
        <>
          <Button
            variant="success"
            size="sm"
            className="w-8 px-0"
            title="Lùi vị trí bắt đầu và kết thúc"
            disabled={!canShiftLeft}
            onClick={onShiftLeft}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="success"
            size="sm"
            className="w-8 px-0"
            title="Tiến vị trí bắt đầu và kết thúc"
            disabled={!canShiftRight}
            onClick={onShiftRight}
          >
            <ChevronRight />
          </Button>
          {rangeLabel && <span className="text-xs tabular-nums text-zinc-400">{rangeLabel}</span>}
        </>
      )}
      <Button
        variant="secondary"
        size="sm"
        disabled={editDisabled}
        title={editTitle}
        onClick={onEdit}
      >
        <Pencil /> Sửa
      </Button>
      <Button variant="danger" size="sm" onClick={onDelete}>
        <Trash2 /> Xóa
      </Button>
    </div>
  );
}

function MainBarPanel({
  title,
  bars,
  form,
  setForm,
  selected,
  onSelect,
  lastAxis,
  onAdd,
  onEdit,
  onDelete,
  onRegionMove,
  showBothEndHooks = false,
  showAutoCut = false,
  spliceFace = "bottom",
  autoCutHint = "",
  onAutoCutChange,
}: {
  title: string;
  bars: MainBar[];
  form: MainBar;
  setForm: (b: MainBar) => void;
  selected: string | null;
  onSelect: (b: MainBar) => void;
  lastAxis: number;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRegionMove?: (start: number, end: number) => void;
  showBothEndHooks?: boolean;
  showAutoCut?: boolean;
  spliceFace?: "top" | "bottom";
  autoCutHint?: string;
  onAutoCutChange?: (autoCut: boolean, lapMultiple: LapMultiple) => void;
}) {
  const addBlocked = mainBarDuplicate(bars, form);
  const editBlocked = mainBarDuplicate(bars, form, selected);
  const hint = addBlocked
    ? `Đã có ${barListLabel(form)} — đổi Ø, số lượng hoặc đoạn trục rồi thêm.`
    : "Không thêm hai dòng giống hệt. Cùng Ø/số lượng nhưng đoạn khác (0→1, 0→3, …) thì được.";
  return (
    <div className="flex flex-wrap gap-3">
      <Panel title={title} className="flex-1 min-w-[260px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Chọn đường kính">
            <Select value={form.dia} onChange={(e) => setForm({ ...form, dia: Number(e.target.value) })}>
              {DIAMETERS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chọn số lượng">
            <Select value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}>
              {QTY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chọn vị trí bắt đầu">
            <Select
              value={form.startAxis}
              onChange={(e) => setForm({ ...form, startAxis: Number(e.target.value) })}
            >
              {axisOptions(lastAxis).map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chọn vị trí kết thúc">
            <Select
              value={form.endAxis}
              onChange={(e) => setForm({ ...form, endAxis: Number(e.target.value) })}
            >
              {axisOptions(lastAxis).map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {showBothEndHooks && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex h-8 cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(form.hooksBothEnds)}
                onCheckedChange={(checked) => {
                  const on = checked === true;
                  setForm({
                    ...form,
                    hooksBothEnds: on,
                    hookHeightMm:
                      on && !(form.hookHeightMm && form.hookHeightMm > 0)
                        ? defaultBottomMainHookMm(form.dia)
                        : form.hookHeightMm,
                  });
                }}
              />
              Có móc 2 đầu
            </label>
            {form.hooksBothEnds ? (
              <Field label="Chiều cao móc (mm)" className="w-40">
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={form.hookHeightMm ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setForm({
                      ...form,
                      hookHeightMm: raw === "" ? undefined : Number(raw) || 0,
                    });
                  }}
                />
              </Field>
            ) : null}
          </div>
        )}
        {showAutoCut && (
          <div className="mt-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex h-8 cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={mainAutoCutOn(form)}
                  onCheckedChange={(checked) => {
                    const on = checked === true;
                    const lapMultiple = normalizeLapMultiple(form.lapMultiple);
                    setForm({
                      ...form,
                      autoCut: on,
                      lapMultiple,
                    });
                    onAutoCutChange?.(on, lapMultiple);
                  }}
                />
                Cắt thép tự động
              </label>
              {mainAutoCutOn(form) ? (
                <Field label="Chiều dài nối" className="w-36">
                  <Select
                    value={normalizeLapMultiple(form.lapMultiple)}
                    onChange={(e) => {
                      const lapMultiple = normalizeLapMultiple(Number(e.target.value));
                      setForm({ ...form, lapMultiple });
                      if (form.autoCut) onAutoCutChange?.(true, lapMultiple);
                    }}
                  >
                    {LAP_MULTIPLES.map((n) => (
                      <option key={n} value={n}>
                        {n}D
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
              {spliceFace === "top"
                ? "Lớp trên: nối chỉ ngoài vùng l₀/4 (giữa nhịp)."
                : "Lớp dưới: nối chỉ trong vùng gối l₀/4."}
            </p>
          </div>
        )}
        {showAutoCut && autoCutHint ? (
          <p
            className={`mt-2 text-[11px] leading-snug ${
              autoCutHint.startsWith("Không cắt được") ? "text-amber-400" : "text-zinc-400"
            }`}
          >
            {autoCutHint}
          </p>
        ) : null}
        <div className="mt-3">
          <CrudButtons
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            addDisabled={addBlocked}
            editDisabled={editBlocked}
            addTitle={
              addBlocked ? `Đã có ${barListLabel(form)} trong danh sách` : "Thêm thanh thép chủ"
            }
            editTitle={
              editBlocked
                ? `Đã có ${barListLabel(form)} — không lưu trùng`
                : "Lưu thay đổi thanh đang chọn"
            }
            onShiftLeft={() => {
              const next = shiftAxisRange(form.startAxis, form.endAxis, -1, lastAxis);
              setForm({ ...form, ...next });
              onRegionMove?.(next.startAxis, next.endAxis);
            }}
            onShiftRight={() => {
              const next = shiftAxisRange(form.startAxis, form.endAxis, 1, lastAxis);
              setForm({ ...form, ...next });
              onRegionMove?.(next.startAxis, next.endAxis);
            }}
            canShiftLeft={canShiftAxisRange(form.startAxis, form.endAxis, -1, lastAxis)}
            canShiftRight={canShiftAxisRange(form.startAxis, form.endAxis, 1, lastAxis)}
            rangeLabel={`${form.startAxis} → ${form.endAxis}`}
          />
        </div>
        <p className={`mt-2 text-[11px] leading-snug ${addBlocked ? "text-amber-400" : "text-zinc-400"}`}>
          {hint}
        </p>
      </Panel>
      <Panel title="Danh sách thép" className="w-56">
        <ul className="max-h-36 overflow-auto text-sm">
          {bars.length === 0 && <li className="text-zinc-500">Chưa có thanh thép</li>}
          {bars.map((b) => (
            <li key={b.id}>
              <button
                className={`w-full rounded px-2 py-1 text-left ${
                  selected === b.id ? "bg-sky-900 text-sky-100" : "hover:bg-zinc-800"
                }`}
                onClick={() => onSelect(b)}
              >
                {barListLabel(b)}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function ExtraBarPanel({
  title,
  bars,
  form,
  setForm,
  selected,
  onSelect,
  lastAxis,
  onAdd,
  onEdit,
  onDelete,
  onRegionMove,
  face,
}: {
  title: string;
  bars: ExtraBar[];
  form: ExtraBar;
  setForm: (b: ExtraBar) => void;
  selected: string | null;
  onSelect: (b: ExtraBar) => void;
  lastAxis: number;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRegionMove?: (start: number, end: number) => void;
  face: "top" | "bottom";
}) {
  const endTypeOpts = extraEndTypeOptions(face);
  const addBlocked = extraBarDuplicate(bars, form);
  const editBlocked = extraBarDuplicate(bars, form, selected);
  const extraHint = addBlocked
    ? `Đã có ${extraLabel(form)} — đổi lớp, Ø, số lượng hoặc đoạn rồi thêm.`
    : face === "top"
      ? "Thép mũ tại gối: 0→0, 1→1, 2→2… Bấm Thêm sẽ chuyển sang gối kế tiếp."
      : "Thép bụng theo nhịp: 0→1, 1→2, 2→3… Bấm Thêm sẽ chuyển sang nhịp kế tiếp.";
  const pinTopAxis = (axis: number) => {
    const pinned = extraTopAtSupport(axis, lastAxis);
    setForm({ ...form, ...pinned });
    onRegionMove?.(pinned.startAxis, pinned.endAxis);
  };
  const pinBottomSpan = (spanIndex: number) => {
    const pinned = extraBottomAtSpan(spanIndex, lastAxis);
    setForm({ ...form, ...pinned });
    onRegionMove?.(pinned.startAxis, pinned.endAxis);
  };
  return (
    <div className="flex flex-wrap gap-3">
      <Panel title={title} className="flex-1 min-w-[280px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <Field label="Chọn lớp (Lớp thứ)">
            <Select value={form.layer} onChange={(e) => setForm({ ...form, layer: Number(e.target.value) })}>
              {LAYER_LABELS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chọn đường kính">
            <Select value={form.dia} onChange={(e) => setForm({ ...form, dia: Number(e.target.value) })}>
              {DIAMETERS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chọn số lượng">
            <Select value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}>
              {QTY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vị trí bắt đầu">
            <Select
              value={form.startAxis}
              onChange={(e) => {
                const axis = Number(e.target.value);
                if (face === "top") pinTopAxis(axis);
                else pinBottomSpan(axis);
              }}
            >
              {axisOptions(lastAxis).map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dạng bắt đầu">
            <Select
              value={form.startType}
              onChange={(e) => setForm({ ...form, startType: Number(e.target.value) as EndType })}
            >
              {endTypeOpts.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vị trí kết thúc">
            <Select
              value={form.endAxis}
              onChange={(e) => {
                const axis = Number(e.target.value);
                if (face === "top") pinTopAxis(axis);
                else pinBottomSpan(axis - 1);
              }}
            >
              {axisOptions(lastAxis).map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dạng kết thúc">
            <Select
              value={form.endType}
              onChange={(e) => setForm({ ...form, endType: Number(e.target.value) as EndType })}
            >
              {endTypeOpts.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <CrudButtons
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            addDisabled={addBlocked}
            editDisabled={editBlocked}
            addTitle={
              addBlocked
                ? `Đã có ${extraLabel(form)} trong danh sách`
                : "Thêm thanh extra"
            }
            editTitle={
              editBlocked
                ? `Đã có ${extraLabel(form)} — không lưu trùng`
                : "Lưu thay đổi thanh đang chọn"
            }
            onShiftLeft={() => {
              if (face === "top") pinTopAxis(form.startAxis - 1);
              else pinBottomSpan(form.startAxis - 1);
            }}
            onShiftRight={() => {
              if (face === "top") pinTopAxis(form.startAxis + 1);
              else pinBottomSpan(form.startAxis + 1);
            }}
            canShiftLeft={form.startAxis > 0}
            canShiftRight={
              face === "top" ? form.startAxis < lastAxis : form.startAxis < lastAxis - 1
            }
            rangeLabel={`${form.startAxis} → ${form.endAxis}`}
          />
        </div>
        <p className={`mt-2 text-[11px] leading-snug ${addBlocked ? "text-amber-400" : "text-zinc-400"}`}>
          {extraHint}
        </p>
      </Panel>
      <div className="flex w-56 shrink-0 flex-col gap-2">
        <Panel title="Danh sách thép">
        <ul className="max-h-36 overflow-auto text-sm">
          {bars.length === 0 && <li className="text-zinc-500">Chưa có thanh thép</li>}
          {bars.map((b) => (
            <li key={b.id}>
              <button
                className={`w-full rounded px-2 py-1 text-left ${
                  selected === b.id ? "bg-sky-900 text-sky-100" : "hover:bg-zinc-800"
                }`}
                onClick={() => onSelect(b)}
              >
                {extraLabel(b)}
              </button>
            </li>
          ))}
        </ul>
        </Panel>
      </div>
    </div>
  );
}

function SecondaryPanel({
  project,
  persist,
}: {
  project: BeamProject;
  persist: (p: BeamProject) => void;
}) {
  const [sel, setSel] = useState<string | null>(project.secondary[0]?.id ?? null);
  const current = project.secondary.find((s) => s.id === sel) ?? project.secondary[0];
  const [form, setForm] = useState(
    current ?? {
      id: uid("sec"),
      kind: "dam-phu" as SecondaryKind,
      position: 1200,
      Cx: 200,
      Dx: 100,
      H: 400,
      shear: true,
      shearKind: "dai" as ShearKind,
      stirrupsEachSide: 5,
    },
  );

  return (
    <div className="flex flex-wrap gap-3">
      <Panel title="Danh sách vị trí các dầm phụ hoặc trụ trên dầm" className="w-56">
        <ul className="mb-2 max-h-32 overflow-auto text-sm">
          {project.secondary.length === 0 && <li className="text-zinc-500">Chưa có</li>}
          {project.secondary.map((s) => (
            <li key={s.id}>
              <button
                className={`w-full rounded px-2 py-1 text-left ${
                  sel === s.id ? "bg-sky-900" : "hover:bg-zinc-800"
                }`}
                onClick={() => {
                  setSel(s.id);
                  setForm(s);
                }}
              >
                ({s.kind === "dam-phu" ? "DP" : "Trụ"}): {s.position}
              </button>
            </li>
          ))}
        </ul>
        <CrudButtons
          onAdd={() => {
            const item = { ...form, id: uid("sec") };
            persist({ ...project, secondary: [...project.secondary, item] });
            setSel(item.id);
          }}
          onEdit={() => {
            if (!sel) return;
            persist({
              ...project,
              secondary: project.secondary.map((s) => (s.id === sel ? { ...form, id: s.id } : s)),
            });
          }}
          onDelete={() => {
            persist({ ...project, secondary: project.secondary.filter((s) => s.id !== sel) });
            setSel(null);
          }}
        />
      </Panel>
      <Panel title="Các thông số" className="flex-1 min-w-[260px]">
        <div className="mb-2 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={form.kind === "dam-phu"}
              onChange={() => setForm({ ...form, kind: "dam-phu" })}
            />
            Dầm phụ
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={form.kind === "tru"}
              onChange={() => setForm({ ...form, kind: "tru" })}
            />
            Trụ trên dầm
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Vị trí">
            <Input
              type="number"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Chiều rộng, B (mm)">
            <Input
              type="number"
              value={form.Cx}
              onChange={(e) => setForm({ ...form, Cx: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Độ lệch trục, Dx (mm)">
            <Input
              type="number"
              value={form.Dx}
              onChange={(e) => setForm({ ...form, Dx: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Chiều cao, H (mm)">
            <Input
              type="number"
              value={form.H}
              onChange={(e) => setForm({ ...form, H: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.shear}
            onChange={(e) => setForm({ ...form, shear: e.target.checked })}
          />
          Có cốt đai gia cường chống cắt
        </label>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              checked={form.shearKind === "dai"}
              onChange={() => setForm({ ...form, shearKind: "dai" })}
            />
            Cốt đai
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              checked={form.shearKind === "treo"}
              onChange={() => setForm({ ...form, shearKind: "treo" })}
            />
            Cốt treo
          </label>
          <Field label="Số lượng đai (mỗi bên)" className="w-36">
            <Input
              type="number"
              value={form.stirrupsEachSide}
              onChange={(e) => setForm({ ...form, stirrupsEachSide: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
      </Panel>
    </div>
  );
}
