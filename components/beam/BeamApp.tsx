"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Field, Panel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BeamPreview } from "@/components/beam/BeamPreview";
import { ExtraShapeSketch } from "@/components/beam/ExtraShapeSketch";
import { SectionSketch } from "@/components/beam/SectionSketch";
import { SupportSketch } from "@/components/beam/SupportSketch";
import {
  applySpanParams,
  applySupportToAll,
  canShiftAxisRange,
  computeModel,
  extraBarLength,
  placeAxisRange,
  shiftAxisRange,
  syncSpanSupportGeometry,
} from "@/lib/calc";
import { downloadPdf, generateBeamPdf } from "@/lib/pdf/generate";
import { createEmptyProject, createSampleD1, defaultStirrupsForLength, syncGeometry } from "@/lib/sample";
import type {
  BeamProject,
  ConnectionType,
  EndType,
  ExtraBar,
  MainBar,
  SecondaryKind,
  ShearKind,
  TabId,
} from "@/lib/types";
import {
  DIAMETERS,
  END_TYPE_OPTIONS,
  LAYER_LABELS,
  QTY_OPTIONS,
  SLAB_TYPES,
  TABS,
  CONNECTION_TYPES,
} from "@/lib/types";
import { CONCRETE_GRADES, STEEL_GRADES, describeEndType, hook90ExtensionMm } from "@/lib/tcvn5574";

const STORE_KEY = "thep-dam-project-v2";

function axisOptions(n: number) {
  return Array.from({ length: n + 1 }, (_, i) => i);
}

function barListLabel(b: MainBar) {
  return `${b.qty}Ø${b.dia}  (${b.startAxis}→${b.endAxis})`;
}

function extraLabel(b: ExtraBar) {
  return `Lớp ${b.layer}: ${b.qty}Ø${b.dia}  (${b.startAxis}→${b.endAxis})`;
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

  const model = useMemo(() => computeModel(project), [project]);
  const lastAxis = project.spans.length;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setProject(JSON.parse(raw) as BeamProject);
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
      const bytes = await generateBeamPdf(project, { regular, bold });
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
    }),
    [lastAxis],
  );

  const [mainForm, setMainForm] = useState<MainBar>(() => draftMain("bottom"));
  const [extraForm, setExtraForm] = useState<ExtraBar>(() => ({
    id: uid("ex"),
    layer: 1,
    dia: 20,
    qty: 2,
    startAxis: 0,
    endAxis: 1,
    startType: 1,
    endType: 2,
  }));

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
    if (tab === "extraBottom" || tab === "extraTop") {
      setExtraForm({
        ...extraForm,
        ...placeAxisRange(extraForm.startAxis, extraForm.endAxis, spanIndex, lastAxis),
      });
    } else if (tab === "mainBottom" || tab === "mainTop") {
      setMainForm({
        ...mainForm,
        ...placeAxisRange(mainForm.startAxis, mainForm.endAxis, spanIndex, lastAxis),
      });
    }
  }

  function addMain(key: "mainBottom" | "mainTop") {
    const bar = { ...mainForm, id: uid("bar") };
    persist({ ...project, [key]: [...project[key], bar] });
    setSelectedBar(bar.id);
  }
  function editMain(key: "mainBottom" | "mainTop") {
    if (!selectedBar) return;
    persist({
      ...project,
      [key]: project[key].map((b) => (b.id === selectedBar ? { ...mainForm, id: b.id } : b)),
    });
  }
  function delMain(key: "mainBottom" | "mainTop") {
    persist({ ...project, [key]: project[key].filter((b) => b.id !== selectedBar) });
    setSelectedBar(null);
  }

  function addExtra(key: "extraBottom" | "extraTop") {
    const bar = { ...extraForm, id: uid("ex") };
    persist({ ...project, [key]: [...project[key], bar] });
    setSelectedBar(bar.id);
  }
  function editExtra(key: "extraBottom" | "extraTop") {
    if (!selectedBar) return;
    persist({
      ...project,
      [key]: project[key].map((b) => (b.id === selectedBar ? { ...extraForm, id: b.id } : b)),
    });
  }
  function delExtra(key: "extraBottom" | "extraTop") {
    persist({ ...project, [key]: project[key].filter((b) => b.id !== selectedBar) });
    setSelectedBar(null);
  }

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="mr-2">
          <div className="text-sm font-bold tracking-wide text-sky-300">Blogger thép bê tông PDF</div>
          <div className="text-[11px] text-zinc-400">Shop thép dầm · thống kê cốt thép</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              persist(createSampleD1());
              setStatus("Đã nạp hình học D1. Thêm thép bằng nút Thêm.");
            }}
          >
            <FolderOpen /> Mẫu D1
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              persist(createEmptyProject());
              setSelectedSpan(0);
              setSelectedSupport(0);
              setStatus("Đã tạo dầm mới.");
            }}
          >
            <FilePlus /> Mới
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
                      max={12}
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
                setSelectedBar(b.id);
                setMainForm(b);
              }}
              lastAxis={lastAxis}
              onAdd={() => addMain(tab === "mainBottom" ? "mainBottom" : "mainTop")}
              onEdit={() => editMain(tab === "mainBottom" ? "mainBottom" : "mainTop")}
              onDelete={() => delMain(tab === "mainBottom" ? "mainBottom" : "mainTop")}
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
                setExtraForm(b);
              }}
              lastAxis={lastAxis}
              hint={
                extraForm.lengthOverride
                  ? `L=${extraForm.lengthOverride}`
                  : `L≈${extraBarLength(project, extraForm, tab === "extraTop" ? "top" : "bottom")}`
              }
              onAdd={() => addExtra(tab === "extraBottom" ? "extraBottom" : "extraTop")}
              onEdit={() => editExtra(tab === "extraBottom" ? "extraBottom" : "extraTop")}
              onDelete={() => delExtra(tab === "extraBottom" ? "extraBottom" : "extraTop")}
              onRegionMove={(start, end) => {
                selectSpan(Math.min(Math.min(start, end), Math.max(0, project.spans.length - 1)));
                void end;
              }}
              face={tab === "extraTop" ? "top" : "bottom"}
              concreteGrade={project.info.concreteGrade}
              steelGrade={project.info.steelGrade}
            />
          )}

          {tab === "stirrups" && (
            <Panel title="Thông số thép đai">
              <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Nhịp đang chọn">
                  <Select
                    value={selectedSpan}
                    onChange={(e) => selectSpan(Number(e.target.value))}
                  >
                    {project.spans.map((_, i) => (
                      <option key={i} value={i}>
                        Nhịp {i + 1} (L={project.spans[i].L})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Đường kính đai">
                  <Select
                    value={project.stirrups[selectedSpan]?.dia ?? 6}
                    onChange={(e) => {
                      const dia = Number(e.target.value);
                      persist({
                        ...project,
                        stirrups: project.stirrups.map((s, i) =>
                          i === selectedSpan ? { ...s, dia } : s,
                        ),
                      });
                    }}
                  >
                    {DIAMETERS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {(["left", "mid", "right"] as const).map((zone) => {
                const st = project.stirrups[selectedSpan];
                if (!st) return null;
                const label =
                  zone === "left" ? "Vùng gối trái" : zone === "mid" ? "Vùng giữa nhịp" : "Vùng gối phải";
                const z = st[zone];
                const patch = (partial: Partial<typeof z>) => {
                  persist({
                    ...project,
                    stirrups: project.stirrups.map((s, i) =>
                      i === selectedSpan ? { ...s, [zone]: { ...s[zone], ...partial } } : s,
                    ),
                  });
                };
                return (
                  <div key={zone} className="mb-2 grid grid-cols-3 gap-2">
                    <Field label={`${label} — số lượng`}>
                      <Input
                        type="number"
                        value={z.count}
                        onChange={(e) => patch({ count: Number(e.target.value) || 0 })}
                      />
                    </Field>
                    <Field label="Khoảng a (mm)">
                      <Input
                        type="number"
                        value={z.spacing}
                        onChange={(e) => patch({ spacing: Number(e.target.value) || 0 })}
                      />
                    </Field>
                    <Field label="Chiều dài vùng (mm)">
                      <Input
                        type="number"
                        value={z.length}
                        onChange={(e) => patch({ length: Number(e.target.value) || 0 })}
                      />
                    </Field>
                  </div>
                );
              })}
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  const src = project.stirrups[selectedSpan];
                  persist({
                    ...project,
                    stirrups: project.stirrups.map((s, i) =>
                      i === selectedSpan
                        ? s
                        : {
                            ...src,
                            left: { ...src.left, length: defaultStirrupsForLength(project.spans[i].L).left.length },
                            mid: { ...src.mid, length: defaultStirrupsForLength(project.spans[i].L).mid.length },
                            right: {
                              ...src.right,
                              length: defaultStirrupsForLength(project.spans[i].L).right.length,
                            },
                          },
                    ),
                  });
                }}
              >
                <Check /> Áp dụng số lượng/khoảng cho các nhịp
              </Button>
            </Panel>
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
                <Field label="Lớp bảo vệ (mm)">
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
          project={project}
          tab={tab}
          selectedSpan={selectedSpan}
          selectedSupport={selectedSupport}
          highlightStart={highlightStart}
          highlightEnd={highlightEnd}
          extraDraft={tab === "extraBottom" || tab === "extraTop" ? extraForm : null}
          onSelectSpan={barRegion ? moveBarRegionToSpan : selectSpan}
          onSelectSupport={selectSupport}
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
}: {
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShiftLeft?: () => void;
  onShiftRight?: () => void;
  canShiftLeft?: boolean;
  canShiftRight?: boolean;
  rangeLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="success" size="sm" onClick={onAdd}>
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
      <Button variant="secondary" size="sm" onClick={onEdit}>
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
}) {
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
        <div className="mt-3">
          <CrudButtons
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
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
  hint,
  onAdd,
  onEdit,
  onDelete,
  onRegionMove,
  face,
  concreteGrade,
  steelGrade,
}: {
  title: string;
  bars: ExtraBar[];
  form: ExtraBar;
  setForm: (b: ExtraBar) => void;
  selected: string | null;
  onSelect: (b: ExtraBar) => void;
  lastAxis: number;
  hint: string;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRegionMove?: (start: number, end: number) => void;
  face: "top" | "bottom";
  concreteGrade?: string;
  steelGrade?: string;
}) {
  const startHint = describeEndType(form.startType, form.dia, concreteGrade, steelGrade);
  const endHint = describeEndType(form.endType, form.dia, concreteGrade, steelGrade);
  const startHook = form.startType === 3 ? hook90ExtensionMm(form.dia) : 0;
  const endHook = form.endType === 3 ? hook90ExtensionMm(form.dia) : 0;
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
              onChange={(e) => setForm({ ...form, startAxis: Number(e.target.value) })}
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
              {END_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <p className="text-[10px] leading-tight text-zinc-500">{startHint}</p>
          </Field>
          <Field label="Vị trí kết thúc">
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
          <Field label="Dạng kết thúc">
            <Select
              value={form.endType}
              onChange={(e) => setForm({ ...form, endType: Number(e.target.value) as EndType })}
            >
              {END_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <p className="text-[10px] leading-tight text-zinc-500">{endHint}</p>
          </Field>
          <Field label="Chiều dài thanh (mm, để trống = tự tính)" className="sm:col-span-2">
            <Input
              type="number"
              value={form.lengthOverride ?? ""}
              placeholder={hint}
              onChange={(e) =>
                setForm({
                  ...form,
                  lengthOverride: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </Field>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <CrudButtons
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
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
          <span className="text-xs text-zinc-500">{hint} · TCVN 5574:2018</span>
        </div>
      </Panel>
      <div className="flex w-56 shrink-0 flex-col gap-2">
        <ExtraShapeSketch
          startType={form.startType}
          endType={form.endType}
          face={face}
          startHook={startHook}
          endHook={endHook}
        />
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
          <Field label="Chiều rộng, Cx (mm)">
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
