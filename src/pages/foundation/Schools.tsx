import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getFniRepository } from "../../shared/fni/repository";
import type { FoundationReviewStatus, FoundationSchoolRow } from "../../shared/fni/schools";
import { useCycleOptions } from "../../shared/useCycleOptions";

type ReviewStatus = FoundationReviewStatus;
type SortKey = "completionAsc" | "completionDesc" | "lastActivityDesc" | "blockingDesc";
type SchoolRow = FoundationSchoolRow;

const STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: "Pendiente",
  IN_REVIEW: "En revisión",
  OBSERVED: "Observado",
  APPROVED: "Aprobado",
  BLOCKED: "Bloqueado",
};

const STATUS_BADGE: Record<ReviewStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-blue-50 text-blue-700",
  OBSERVED: "bg-amber-50 text-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-700",
  BLOCKED: "bg-rose-50 text-rose-700",
};

function clampPct(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function fmtAgo(iso?: string) {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}

function pctBucket(p: number): "0-25" | "26-50" | "51-75" | "76-100" {
  const x = clampPct(p);
  if (x <= 25) return "0-25";
  if (x <= 50) return "26-50";
  if (x <= 75) return "51-75";
  return "76-100";
}

function ProgressBar({ value }: { value: number }) {
  const v = clampPct(value);
  return (
    <div className="w-full">
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-slate-900" style={{ width: `${v}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-600">{v}%</div>
    </div>
  );
}

function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "danger" | "warn" }) {
  const cls =
    tone === "danger"
      ? "bg-rose-50 text-rose-700"
      : tone === "warn"
      ? "bg-amber-50 text-amber-800"
      : "bg-slate-100 text-slate-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs ${cls}`}>{children}</span>;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default function FoundationSchoolsPage() {
  const repository = getFniRepository();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCycleId = searchParams.get("cycleId") ?? "2026";
  const [cycleId, setCycleId] = useState<string>(initialCycleId);
  const { cycles, loading: cyclesLoading } = useCycleOptions(cycleId);

  const [view, setView] = useState<"cards" | "table">("cards");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ReviewStatus | "ALL">("ALL");
  const [bucket, setBucket] = useState<"ALL" | "0-25" | "26-50" | "51-75" | "76-100">("ALL");
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [sort, setSort] = useState<SortKey>("completionAsc");

  const [items, setItems] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cycleQuery = `?cycleId=${encodeURIComponent(cycleId)}`;

  function buildSchoolLabel(school: SchoolRow) {
    return `${school.code} - ${school.name}`;
  }

  useEffect(() => {
    setCycleId(initialCycleId);
  }, [initialCycleId]);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await repository.listFoundationSchools(cycleId);
      setItems(data);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Error cargando colegios");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId, repository]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let out = [...items];

    if (qq) {
      out = out.filter((s) => {
        const hay = `${s.code} ${s.name} ${s.managerName ?? ""} ${s.managerEmail ?? ""}`.toLowerCase();
        return hay.includes(qq);
      });
    }
    if (status !== "ALL") out = out.filter((s) => s.status === status);
    if (bucket !== "ALL") out = out.filter((s) => pctBucket(s.completionPct) === bucket);
    if (onlyBlocked) out = out.filter((s) => (s.blockingCount ?? 0) > 0 || s.status === "BLOCKED");

    out.sort((a, b) => {
      const ap = clampPct(a.completionPct);
      const bp = clampPct(b.completionPct);
      const ad = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const bd = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      const ab = a.blockingCount ?? 0;
      const bb = b.blockingCount ?? 0;

      switch (sort) {
        case "completionAsc":
          return ap - bp;
        case "completionDesc":
          return bp - ap;
        case "lastActivityDesc":
          return bd - ad;
        case "blockingDesc":
          return bb - ab;
        default:
          return 0;
      }
    });

    return out;
  }, [items, q, status, bucket, onlyBlocked, sort]);

  const kpis = useMemo(() => {
    const total = items.length || 0;
    const avg = total ? Math.round(items.reduce((acc, s) => acc + clampPct(s.completionPct), 0) / total) : 0;
    const pending = items.reduce((acc, s) => acc + (s.pendingCount ?? 0), 0);
    const blocked = items.filter((s) => (s.blockingCount ?? 0) > 0 || s.status === "BLOCKED").length;
    const observed = items.filter((s) => s.status === "OBSERVED").length;
    return { total, avg, pending, blocked, observed };
  }, [items]);

  return (
    <div className="fni-page-shell">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="fni-page-title">Colegios</h1>
          <p className="fni-page-subtitle">Seguimiento por ciclo actual: completitud, estado y revisión.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cycleId}
            onChange={(e) => {
              const nextCycleId = e.target.value;
              setCycleId(nextCycleId);
              const nextSearchParams = new URLSearchParams(searchParams);
              nextSearchParams.set("cycleId", nextCycleId);
              setSearchParams(nextSearchParams, { replace: true });
            }}
            disabled={cyclesLoading}
            className="fni-cycle-select"
            title="Ciclo"
          >
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </select>

          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              className={`fni-tab-button ${view === "cards" ? "fni-tab-button-active" : ""}`}
              onClick={() => setView("cards")}
            >
              Cards
            </button>
            <button
              className={`fni-tab-button ${view === "table" ? "fni-tab-button-active" : ""}`}
              onClick={() => setView("table")}
            >
              Tabla
            </button>
          </div>

          <button
            onClick={load}
            className="fni-toolbar-button"
          >
            Refrescar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <StatCard label="Colegios" value={`${kpis.total}`} />
        <StatCard label="Completitud promedio" value={`${kpis.avg}%`} hint="Ciclo actual" />
        <StatCard label="Pendientes" value={`${kpis.pending}`} hint="Indicadores por completar" />
        <StatCard label="Bloqueados" value={`${kpis.blocked}`} hint="Con bloqueantes" />
        <StatCard label="Observados" value={`${kpis.observed}`} hint="Requieren ajustes" />
      </div>

      {/* Filters */}
    <div className="fni-data-panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-4">
            <label className="fni-field-label">Buscar</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Código, nombre, encargado..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="md:col-span-2">
            <label className="fni-field-label">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ReviewStatus | "ALL")}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
            >
              <option value="ALL">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="IN_REVIEW">En revisión</option>
              <option value="OBSERVED">Observado</option>
              <option value="APPROVED">Aprobado</option>
              <option value="BLOCKED">Bloqueado</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="fni-field-label">Completitud</label>
            <select
              value={bucket}
              onChange={(e) =>
                setBucket(e.target.value as "ALL" | "0-25" | "26-50" | "51-75" | "76-100")
              }
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
            >
              <option value="ALL">Todos</option>
              <option value="0-25">0-25%</option>
              <option value="26-50">26-50%</option>
              <option value="51-75">51-75%</option>
              <option value="76-100">76-100%</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="fni-field-label">Orden</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
            >
              <option value="completionAsc">Completitud (menor a mayor)</option>
              <option value="completionDesc">Completitud (mayor a menor)</option>
              <option value="lastActivityDesc">Última actividad (reciente)</option>
              <option value="blockingDesc">Más bloqueantes</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="fni-field-label">Opciones</label>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={onlyBlocked}
                onChange={(e) => setOnlyBlocked(e.target.checked)}
                className="h-4 w-4"
              />
              Solo con bloqueantes
            </label>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Tip: ordena por <span className="font-medium">"Completitud (menor a mayor)"</span> para atacar primero lo crítico.
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="fni-data-panel p-6 text-sm text-slate-600">
          Cargando colegios...
        </div>
      )}

      {!loading && err && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {err}
        </div>
      )}

      {!loading && !err && view === "cards" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <div key={s.id} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{s.code}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{s.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Última actividad: {fmtAgo(s.lastActivityAt)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Ciclo</div>
                  <div className="text-sm font-semibold text-slate-900">{s.cycleId}</div>
                </div>
              </div>

              <div className="mt-3">
                <ProgressBar value={s.completionPct} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(s.blockingCount ?? 0) > 0 && <Chip tone="danger">Bloqueantes: {s.blockingCount}</Chip>}
                {(s.observedCount ?? 0) > 0 && <Chip tone="warn">Observaciones: {s.observedCount}</Chip>}
                {(s.missingEvidenceCount ?? 0) > 0 && <Chip>Sin evidencia: {s.missingEvidenceCount}</Chip>}
                {(s.pendingCount ?? 0) > 0 && <Chip>Pendientes: {s.pendingCount}</Chip>}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`/foundation/schools/${encodeURIComponent(s.id)}/form${cycleQuery}&schoolLabel=${encodeURIComponent(buildSchoolLabel(s))}`}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  Ver formulario
                </Link>
                <Link
                  to={`/foundation/schools/${encodeURIComponent(s.id)}/documents${cycleQuery}&schoolLabel=${encodeURIComponent(buildSchoolLabel(s))}`}
                  className="fni-toolbar-button"
                >
                  Documentos
                </Link>
                <Link
                  to={`/foundation/schools/${encodeURIComponent(s.id)}/review${cycleQuery}&schoolLabel=${encodeURIComponent(buildSchoolLabel(s))}`}
                  className="fni-toolbar-button"
                >
                  Revisión
                </Link>
              </div>

              {s.managerEmail && (
                <div className="mt-auto border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="font-medium text-slate-700">Correo del colegio</div>
                  <div className="break-all text-slate-900">{s.managerEmail}</div>
                  {s.managerName && s.managerName.trim().toLowerCase() !== "encargado/a" && (
                    <div className="mt-1 text-slate-500">Encargado/a: {s.managerName}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !err && view === "table" && (
        <div className="fni-data-table-shell">
          <div className="fni-data-table-scroll">
            <table className="fni-data-table">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Colegio</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Completitud</th>
                  <th className="px-4 py-3 text-left font-medium">Pendientes</th>
                  <th className="px-4 py-3 text-left font-medium">Riesgos</th>
                  <th className="px-4 py-3 text-left font-medium">Última actividad</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{s.code}</div>
                      <div className="text-slate-600">{s.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                      <div className="mt-1 text-xs text-slate-500">Ciclo {s.cycleId}</div>
                    </td>
                    <td className="px-4 py-3 w-[220px]">
                      <ProgressBar value={s.completionPct} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{s.pendingCount ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {(s.blockingCount ?? 0) > 0 && <Chip tone="danger">Bloq {s.blockingCount}</Chip>}
                        {(s.observedCount ?? 0) > 0 && <Chip tone="warn">Obs {s.observedCount}</Chip>}
                        {(s.missingEvidenceCount ?? 0) > 0 && <Chip>Sin evid {s.missingEvidenceCount}</Chip>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmtAgo(s.lastActivityAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/foundation/schools/${encodeURIComponent(s.id)}/form${cycleQuery}&schoolLabel=${encodeURIComponent(buildSchoolLabel(s))}`}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white"
                        >
                          Formulario
                        </Link>
                        <Link
                          to={`/foundation/schools/${encodeURIComponent(s.id)}/documents${cycleQuery}&schoolLabel=${encodeURIComponent(buildSchoolLabel(s))}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Docs
                        </Link>
                        <Link
                          to={`/foundation/schools/${encodeURIComponent(s.id)}/review${cycleQuery}&schoolLabel=${encodeURIComponent(buildSchoolLabel(s))}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Revisión
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-600">
                      No hay resultados con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
