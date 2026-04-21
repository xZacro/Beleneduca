import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ROUTES } from "../../app/routes/routeConfig";
import type { CycleSummaryDto } from "../../shared/admin/apiContracts";
import { hasRole } from "../../shared/auth";
import { useCycleOptions } from "../../shared/useCycleOptions";
import {
  closeManagementCycle,
  createManagementCycle,
  getManagementDashboard,
  reopenManagementCycle,
  updateManagementCycle,
} from "../../shared/management/client";
import { useResolvedAuthUser } from "../../shared/useResolvedAuthUser";
import { normalizeSchoolCode, normalizeSchoolName } from "../../shared/fni/schools";
import type {
  ManagementDashboardDto,
  ManagementDashboardIssueDto,
  ManagementDashboardSchoolDto,
} from "../../shared/management/apiContracts";

// Dashboard operativo de fundacion: ciclos, colegios, issues y gestion de cierre/reapertura.
type ManagementDashboardMode = "foundation" | "admin";
type ComplianceCategory = "Optima" | "Buena" | "Media" | "Baja" | "Muy baja";
const EMPTY_SCHOOLS: ManagementDashboardSchoolDto[] = [];
const EMPTY_ISSUES: ManagementDashboardIssueDto[] = [];

function kpiTone(kind: "blue" | "amber" | "green" | "rose" | "slate") {
  if (kind === "blue") return { shell: "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white", value: "text-blue-700", accent: "bg-blue-500" };
  if (kind === "amber") return { shell: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white", value: "text-amber-700", accent: "bg-amber-500" };
  if (kind === "green") return { shell: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white", value: "text-emerald-700", accent: "bg-emerald-500" };
  if (kind === "rose") return { shell: "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white", value: "text-rose-700", accent: "bg-rose-500" };
  return { shell: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white", value: "text-slate-700", accent: "bg-slate-500" };
}

function badgeTone(kind: "blue" | "amber" | "green" | "rose" | "slate") {
  if (kind === "blue") return "border-blue-200 bg-blue-50 text-blue-800";
  if (kind === "amber") return "border-amber-200 bg-amber-50 text-amber-800";
  if (kind === "green") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (kind === "rose") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function barTone(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-blue-500";
  if (pct >= 25) return "bg-amber-500";
  return "bg-rose-500";
}

function categoryTone(category: ComplianceCategory) {
  if (category === "Optima") return "bg-emerald-100 text-emerald-900";
  if (category === "Buena") return "bg-lime-100 text-lime-900";
  if (category === "Media") return "bg-yellow-100 text-yellow-900";
  if (category === "Baja") return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-900";
}

function formatPercent(value: number) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatRelative(value: string | null) {
  if (!value) return "-";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return "Recién";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

function getComplianceCategory(progress: number): ComplianceCategory {
  if (progress >= 90) return "Optima";
  if (progress >= 80) return "Buena";
  if (progress >= 70) return "Media";
  if (progress >= 60) return "Baja";
  return "Muy baja";
}

function statusLabel(status: ManagementDashboardSchoolDto["status"]) {
  if (status === "APPROVED") return "Aprobado";
  if (status === "OBSERVED") return "Observado";
  if (status === "BLOCKED") return "Bloqueado";
  if (status === "IN_REVIEW") return "En revisión";
  return "Pendiente";
}

function statusTone(status: ManagementDashboardSchoolDto["status"]) {
  if (status === "APPROVED") return "green";
  if (status === "OBSERVED") return "amber";
  if (status === "BLOCKED") return "rose";
  if (status === "IN_REVIEW") return "blue";
  return "slate";
}

function MiniBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "blue" | "amber" | "green" | "rose" | "slate";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone(
        tone
      )}`}
    >
      {children}
    </span>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone: "blue" | "amber" | "green" | "rose" | "slate";
}) {
  const styles = kpiTone(tone);

  return (
    <div className={`fni-metric-card ${styles.shell}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
        <span className={`mt-1 h-2.5 w-10 rounded-full ${styles.accent}`} />
      </div>
      <div className={`mt-4 text-4xl font-semibold tracking-tight ${styles.value}`}>{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</div>
    </div>
  );
}

type CycleMode = "edit" | "create";
type CycleBusyAction = "create" | "update" | "close" | "reopen";

type CycleFormState = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
};

function formatDateInput(value: string | null) {
  if (!value) return "";

  const dateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (dateMatch) {
    return dateMatch[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCycleFormFromCycle(cycle: CycleSummaryDto): CycleFormState {
  return {
    id: cycle.id,
    name: cycle.name,
    startsAt: formatDateInput(cycle.startsAt),
    endsAt: formatDateInput(cycle.endsAt),
  };
}

function buildNextCycleId(cycles: CycleSummaryDto[]) {
  const numericIds = cycles
    .filter((cycle) => /^\d+$/.test(cycle.id))
    .map((cycle) => Number.parseInt(cycle.id, 10))
    .filter((value) => Number.isFinite(value));

  const baseCandidate =
    numericIds.length > 0 ? Math.max(...numericIds) + 1 : new Date().getFullYear() + 1;
  let candidate = baseCandidate;

  while (cycles.some((cycle) => cycle.id === String(candidate))) {
    candidate += 1;
  }

  return String(candidate);
}

function buildNewCycleForm(cycles: CycleSummaryDto[]): CycleFormState {
  const nextId = buildNextCycleId(cycles);

  return {
    id: nextId,
    name: `Ciclo ${nextId}`,
    startsAt: "",
    endsAt: "",
  };
}

function validateCycleForm(form: CycleFormState, mode: CycleMode) {
  if (mode === "create") {
    const cycleId = form.id.trim();
    if (!cycleId) {
      return "Debes indicar el id del nuevo ciclo.";
    }

    if (!/^[A-Za-z0-9_-]+$/.test(cycleId)) {
      return "El id del ciclo solo puede usar letras, numeros, guiones y guion bajo.";
    }
  }

  if (!form.name.trim()) {
    return "Debes indicar el nombre visible del ciclo.";
  }

  if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) {
    return "La fecha de termino no puede ser anterior a la fecha de inicio.";
  }

  return null;
}

function ConsolidatedResultsTable({
  schools,
  cycleLabel,
}: {
  schools: ManagementDashboardSchoolDto[];
  cycleLabel: string;
}) {
  const rows = [...schools].sort((left, right) => right.completionPct - left.completionPct);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{`Resultados consolidados ${cycleLabel}`}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Consolidado del ciclo cerrado, construido con la información registrada.
          </p>
        </div>

        <MiniBadge tone="green">Ciclo cerrado</MiniBadge>
      </div>

      <div className="mt-4 fni-data-table-shell">
        <div className="fni-data-table-scroll">
          <table className="fni-data-table">
            <thead className="bg-slate-900">
              <tr className="text-left text-sm text-white">
                <th className="px-4 py-3 font-medium">Colegio</th>
                <th className="px-4 py-3 font-medium">Cumplimiento</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Última actividad</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.map((row) => {
                const category = getComplianceCategory(row.completionPct);

                return (
                  <tr key={row.id} className="text-sm text-slate-700">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{row.code}</div>
                      <div className="text-xs text-slate-500">{row.name}</div>
                    </td>
                    <td className="px-4 py-3">{formatPercent(row.completionPct)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-lg px-3 py-1 font-medium ${categoryTone(category)}`}>
                        {category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <MiniBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</MiniBadge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(row.lastActivityAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function issueLink(cycleId: string, issue: ManagementDashboardIssueDto) {
  const params = new URLSearchParams({
    cycleId,
    indicator: issue.indicatorId,
  });

  if (issue.areaId) {
    params.set("area", issue.areaId);
  }

  return `/foundation/schools/${encodeURIComponent(issue.schoolId)}/review?${params.toString()}`;
}

function schoolReviewLink(cycleId: string, schoolId: string) {
  return `/foundation/schools/${encodeURIComponent(schoolId)}/review?cycleId=${encodeURIComponent(cycleId)}`;
}

function schoolDocumentsLink(cycleId: string, schoolId: string) {
  return `/foundation/schools/${encodeURIComponent(schoolId)}/documents?cycleId=${encodeURIComponent(cycleId)}`;
}

export function ManagementDashboard({ mode }: { mode: ManagementDashboardMode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const cycleId = searchParams.get("cycleId") ?? "2026";
  const [refreshVersion, setRefreshVersion] = useState(0);
  const { cycles, loading: cyclesLoading } = useCycleOptions(cycleId, refreshVersion);

  const [dashboard, setDashboard] = useState<ManagementDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycleMode, setCycleMode] = useState<CycleMode>("edit");
  const [cycleForm, setCycleForm] = useState<CycleFormState>(() => buildNewCycleForm(cycles));
  const [cycleBusyAction, setCycleBusyAction] = useState<CycleBusyAction | null>(null);
  const [cycleActionError, setCycleActionError] = useState<string | null>(null);
  const [cycleActionNotice, setCycleActionNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      // Traemos un snapshot consolidado del ciclo seleccionado y lo usamos para toda la vista.
      setLoading(true);
      setError(null);

      try {
        const payload = await getManagementDashboard(cycleId);
        if (!cancelled) {
          setDashboard(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setDashboard(null);
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar esta vista.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [cycleId, refreshVersion]);

  const schools = dashboard?.schools ?? EMPTY_SCHOOLS;
  const issues = dashboard?.issues ?? EMPTY_ISSUES;
  const cycle = dashboard?.cycle ?? null;
  const canReopenCycle = mode === "admin";
  const isCycleBusy = cycleBusyAction !== null;
  const isClosedSelectedCycle = cycleMode === "edit" && Boolean(cycle?.isClosed);
  const cycleFieldsDisabled = isCycleBusy || isClosedSelectedCycle;

  useEffect(() => {
    if (cycleMode === "edit" && cycle) {
      setCycleForm(buildCycleFormFromCycle(cycle));
    }
  }, [cycle, cycleMode]);

  const summary = useMemo(() => {
    const schoolsCount = schools.length;
    const avgProgress =
      schoolsCount > 0
        ? Math.round(schools.reduce((acc, school) => acc + school.completionPct, 0) / schoolsCount)
        : 0;
    const pendingReview = schools.reduce((acc, school) => acc + school.pendingCount, 0);
    const blockedCount = schools.reduce((acc, school) => acc + school.blockingCount, 0);
    const observedCount = schools.reduce((acc, school) => acc + school.observedCount, 0);
    const submittedCount = schools.filter((school) => school.submitted).length;
    const noSubmissionCount = schoolsCount - submittedCount;

    return {
      schoolsCount,
      avgProgress,
      pendingReview,
      blockedCount,
      observedCount,
      submittedCount,
      noSubmissionCount,
    };
  }, [schools]);

  const attentionSchools = useMemo(() => {
    return [...schools].sort((left, right) => {
      const leftScore =
        left.blockingCount * 100 +
        left.observedCount * 20 +
        left.pendingCount * 2 +
        (left.submitted ? 0 : 50);
      const rightScore =
        right.blockingCount * 100 +
        right.observedCount * 20 +
        right.pendingCount * 2 +
        (right.submitted ? 0 : 50);

      return rightScore - leftScore;
    });
  }, [schools]);

  const dashboardTitle = mode === "admin" ? "Panel del ciclo" : "Panel de Fundación";
  const dashboardSection = mode === "admin" ? "Operación" : "Fundación";
  const dashboardDescription =
    mode === "admin"
      ? "Vista operativa del ciclo con permisos ampliados para administración."
      : "Vista global del ciclo con colegios, riesgos y revisión priorizada.";

  const onCycleChange = (nextCycle: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("cycleId", nextCycle);
    setSearchParams(nextSearchParams);
    setCycleMode("edit");
    setCycleActionError(null);
    setCycleActionNotice(null);
  };

  const beginCreateCycle = () => {
    setCycleMode("create");
    setCycleForm(buildNewCycleForm(cycles));
    setCycleActionError(null);
    setCycleActionNotice(null);
  };

  const restoreSelectedCycle = () => {
    if (!cycle) return;

    setCycleMode("edit");
    setCycleForm(buildCycleFormFromCycle(cycle));
    setCycleActionError(null);
    setCycleActionNotice(null);
  };

  const onCycleFormChange = (patch: Partial<CycleFormState>) => {
    setCycleForm((current) => ({
      ...current,
      ...patch,
    }));
  };

  const onSaveCycle = async () => {
    if (cycleMode === "edit" && cycle?.isClosed) {
      setCycleActionError("El ciclo esta cerrado. Debe reabrirse antes de editar su configuracion.");
      setCycleActionNotice(null);
      return;
    }

    const validationError = validateCycleForm(cycleForm, cycleMode);
    if (validationError) {
      setCycleActionError(validationError);
      setCycleActionNotice(null);
      return;
    }

    setCycleBusyAction(cycleMode === "create" ? "create" : "update");
    setCycleActionError(null);
    setCycleActionNotice(null);

    try {
      if (cycleMode === "create") {
        const created = await createManagementCycle({
          id: cycleForm.id.trim(),
          name: cycleForm.name.trim(),
          startsAt: cycleForm.startsAt || null,
          endsAt: cycleForm.endsAt || null,
        });

        setDashboard((current) => ({
          cycle: created,
          schools: current && current.cycle.id === created.id ? current.schools : [],
          issues: current && current.cycle.id === created.id ? current.issues : [],
        }));
        setCycleForm(buildCycleFormFromCycle(created));
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set("cycleId", created.id);
        setSearchParams(nextSearchParams);
        setCycleMode("edit");
        setCycleActionNotice(`Ciclo ${created.name} creado y abierto correctamente.`);
        setRefreshVersion((current) => current + 1);
        return;
      }

      if (!cycle) return;

      const updated = await updateManagementCycle(cycle.id, {
        name: cycleForm.name.trim(),
        startsAt: cycleForm.startsAt || null,
        endsAt: cycleForm.endsAt || null,
      });

      setDashboard((current) => (current ? { ...current, cycle: updated } : current));
      setCycleForm(buildCycleFormFromCycle(updated));
      setCycleActionNotice(`Configuracion de ${updated.name} actualizada.`);
      setRefreshVersion((current) => current + 1);
    } catch (saveError) {
      setCycleActionError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar el ciclo."
      );
    } finally {
      setCycleBusyAction(null);
    }
  };

  const onCloseCycle = async () => {
    if (!cycle || cycle.isClosed) return;

    setCycleBusyAction("close");
    setCycleActionError(null);
    setCycleActionNotice(null);

    try {
      const closed = await closeManagementCycle(cycle.id);
      setDashboard((current) => (current ? { ...current, cycle: closed } : current));
      setCycleForm(buildCycleFormFromCycle(closed));
      setCycleActionNotice(`${closed.name} fue cerrado correctamente.`);
      setRefreshVersion((current) => current + 1);
    } catch (closeError) {
      setCycleActionError(
        closeError instanceof Error ? closeError.message : "No se pudo cerrar el ciclo."
      );
    } finally {
      setCycleBusyAction(null);
    }
  };

  const onReopenCycle = async () => {
    if (!cycle || !cycle.isClosed || !canReopenCycle) return;

    setCycleBusyAction("reopen");
    setCycleActionError(null);
    setCycleActionNotice(null);

    try {
      const reopened = await reopenManagementCycle(cycle.id);
      setDashboard((current) => (current ? { ...current, cycle: reopened } : current));
      setCycleForm(buildCycleFormFromCycle(reopened));
      setCycleActionNotice(`${reopened.name} fue reabierto correctamente.`);
      setRefreshVersion((current) => current + 1);
    } catch (reopenError) {
      setCycleActionError(
        reopenError instanceof Error ? reopenError.message : "No se pudo reabrir el ciclo."
      );
    } finally {
      setCycleBusyAction(null);
    }
  };

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="fni-page-kicker">
            Dashboard <span className="mx-2">/</span> {dashboardSection} <span className="mx-2">/</span> Ciclo{" "}
            {cycleId}
          </div>
          <h1 className="fni-page-title">{dashboardTitle}</h1>
          <p className="fni-page-subtitle">{dashboardDescription}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cycleId}
            onChange={(event) => onCycleChange(event.target.value)}
            disabled={cyclesLoading}
            className="fni-cycle-select"
            aria-label="Ciclo"
            title="Ciclo"
          >
            {cycles.map((cycleOption) => (
              <option key={cycleOption.id} value={cycleOption.id}>
                {cycleOption.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={beginCreateCycle}
            disabled={cyclesLoading || loading || isCycleBusy}
            className={cycleMode === "create" ? "fni-toolbar-button" : "fni-toolbar-button-primary"}
          >
            {cycleMode === "create" ? "Nuevo ciclo en edición" : "Nuevo ciclo"}
          </button>

          <Link
            to={`${ROUTES.foundation.schools}?cycleId=${encodeURIComponent(cycleId)}`}
            className="fni-toolbar-button"
          >
            Ver colegios
          </Link>
        </div>
      </div>

      {loading && (
        <div className="fni-data-panel p-6 text-sm text-slate-600">Cargando vista...</div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      {!loading && cycle && (
        <>
          <div
            className={`rounded-2xl border p-4 ${
              cycle.isClosed
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-blue-200 bg-blue-50 text-blue-900"
            }`}
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold">
                  {cycle.isClosed ? `${cycle.name} cerrado` : `${cycle.name} activo`}
                </div>
                <div className="mt-1 text-sm">
                  {cycle.isClosed
                    ? `El consolidado del ciclo ya está habilitado.${cycle.closedAt ? ` Cierre registrado el ${formatDate(cycle.closedAt)}.` : ""}`
                    : `${summary.submittedCount} colegios ya enviaron su formulario, ${summary.noSubmissionCount} aún no lo ha enviado y hay ${summary.blockedCount} bloqueantes críticos abiertos.`}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <MiniBadge tone="blue">Activos: {summary.schoolsCount}</MiniBadge>
                <MiniBadge tone="amber">Pendientes de revisión: {summary.pendingReview}</MiniBadge>
                <MiniBadge tone="rose">Bloqueantes: {summary.blockedCount}</MiniBadge>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Gestión del ciclo</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Fundación y administración pueden crear, editar y cerrar ciclos abiertos. Solo
                  administración puede reabrirlos.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <MiniBadge tone={cycleMode === "create" ? "amber" : cycle?.isClosed ? "slate" : "blue"}>
                  {cycleMode === "create" ? "Nuevo ciclo" : cycle?.isClosed ? "Cerrado" : "Activo"}
                </MiniBadge>
                {cycle && <MiniBadge tone="green">{cycle.name}</MiniBadge>}
              </div>
            </div>

            {cycleActionError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {cycleActionError}
              </div>
            )}

            {cycleActionNotice && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                {cycleActionNotice}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="fni-field-label">Id del ciclo</label>
                  <input
                    value={cycleForm.id}
                    disabled={cycleMode === "edit" || isCycleBusy}
                    onChange={(event) => onCycleFormChange({ id: event.target.value })}
                    className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                      cycleMode === "edit" || isCycleBusy
                        ? "cursor-not-allowed bg-slate-100 text-slate-500"
                        : "bg-white"
                    }`}
                    placeholder="2027"
                  />
                </div>

                <div>
                  <label className="fni-field-label">Nombre visible</label>
                  <input
                    value={cycleForm.name}
                    disabled={cycleFieldsDisabled}
                    onChange={(event) => onCycleFormChange({ name: event.target.value })}
                    className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                      cycleFieldsDisabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "bg-white"
                    }`}
                    placeholder="Ciclo 2027"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="fni-field-label">Fecha de inicio</label>
                  <input
                    type="date"
                    value={cycleForm.startsAt}
                    disabled={cycleFieldsDisabled}
                    onChange={(event) => onCycleFormChange({ startsAt: event.target.value })}
                    className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                      cycleFieldsDisabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "bg-white"
                    }`}
                  />
                </div>

                <div>
                  <label className="fni-field-label">Fecha de termino</label>
                  <input
                    type="date"
                    value={cycleForm.endsAt}
                    disabled={cycleFieldsDisabled}
                    onChange={(event) => onCycleFormChange({ endsAt: event.target.value })}
                    className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                      cycleFieldsDisabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "bg-white"
                    }`}
                  />
                </div>
              </div>

              {cycleMode === "edit" && cycle?.isClosed && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {canReopenCycle
                    ? "El ciclo está cerrado. Reábrelo para volver a editar su configuración y permitir nuevos cambios."
                    : "El ciclo está cerrado. Un administrador debe reabrirlo antes de volver a editarlo."}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => void onSaveCycle()}
                  disabled={isCycleBusy || isClosedSelectedCycle}
                  className={
                    isCycleBusy || isClosedSelectedCycle
                      ? "fni-toolbar-button opacity-70"
                      : "fni-toolbar-button-primary"
                  }
                >
                  {cycleBusyAction === "create"
                    ? "Abriendo ciclo..."
                    : cycleBusyAction === "update"
                    ? "Guardando..."
                    : cycleMode === "create"
                    ? "Crear ciclo"
                    : cycle?.isClosed
                    ? "Ciclo cerrado"
                    : "Guardar configuración"}
                </button>

                {cycleMode === "create" ? (
                  <button
                    type="button"
                    onClick={restoreSelectedCycle}
                    disabled={isCycleBusy}
                    className="fni-toolbar-button"
                  >
                    Cancelar nuevo ciclo
                  </button>
                ) : cycle?.isClosed ? (
                  <button
                    type="button"
                    onClick={() => void onReopenCycle()}
                    disabled={isCycleBusy || !canReopenCycle}
                    className="fni-toolbar-button"
                  >
                    {cycleBusyAction === "reopen"
                      ? "Reabriendo..."
                      : canReopenCycle
                      ? "Reabrir ciclo"
                      : "Solo admin puede reabrir"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onCloseCycle()}
                    disabled={isCycleBusy}
                    className="fni-toolbar-button"
                  >
                    {cycleBusyAction === "close" ? "Cerrando..." : `Cerrar ${cycle?.name ?? "ciclo"}`}
                  </button>
                )}

                <Link
                  to={`${ROUTES.foundation.schools}?cycleId=${encodeURIComponent(cycleId)}`}
                  className="fni-toolbar-button text-center"
                >
                  Ver colegios
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <KpiCard
              title="Colegios activos"
              value={summary.schoolsCount}
              subtitle={`${summary.submittedCount} enviados / ${summary.noSubmissionCount} sin envío`}
              tone="blue"
            />
            <KpiCard
              title="Avance global"
              value={`${summary.avgProgress}%`}
              subtitle="Promedio real de completitud"
              tone="green"
            />
            <KpiCard
              title="Pendientes por revisar"
              value={summary.pendingReview}
              subtitle="Indicadores en bandeja de revisión"
              tone="amber"
            />
            <KpiCard
              title="Observados / bloqueados"
              value={summary.observedCount + summary.blockedCount}
              subtitle={`${summary.observedCount} observados / ${summary.blockedCount} bloqueados`}
              tone="rose"
            />
          </div>

          {cycle.isClosed ? (
            <ConsolidatedResultsTable schools={schools} cycleLabel={cycle.name} />
          ) : (
            <div className="fni-empty-state-panel bg-slate-50">
              Los resultados consolidados aparecerán aquí cuando el ciclo se cierre.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Colegios que requieren atención</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Priorizados por bloqueos, observaciones, pendientes y falta de envío.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {attentionSchools.map((school) => {
                  const schoolCode = normalizeSchoolCode(school.code);
                  const displayName = normalizeSchoolName(schoolCode, school.name);

                  return (
                    <div key={school.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">{displayName}</div>
                            <MiniBadge tone={school.submitted ? "blue" : "amber"}>
                              {school.submitted ? "Enviado" : "Sin envío"}
                            </MiniBadge>
                            <MiniBadge tone={statusTone(school.status)}>{statusLabel(school.status)}</MiniBadge>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {school.pendingCount > 0 && (
                              <MiniBadge tone="amber">Pendientes: {school.pendingCount}</MiniBadge>
                            )}
                            {school.observedCount > 0 && (
                              <MiniBadge tone="amber">Observados: {school.observedCount}</MiniBadge>
                            )}
                            {school.blockingCount > 0 && (
                              <MiniBadge tone="rose">Bloqueados: {school.blockingCount}</MiniBadge>
                            )}
                            {school.missingEvidenceCount > 0 && (
                              <MiniBadge tone="slate">Sin evidencia: {school.missingEvidenceCount}</MiniBadge>
                            )}
                          </div>

                          <div className="mt-3">
                            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                              <span>Avance</span>
                              <span>{school.completionPct}%</span>
                            </div>

                            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${barTone(school.completionPct)}`}
                                style={{ width: `${school.completionPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-2 text-xs text-slate-500">
                            Última actividad: {formatRelative(school.lastActivityAt)}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Link to={schoolReviewLink(cycle.id, school.id)} className="fni-toolbar-button-primary">
                            Revisión
                          </Link>
                          <Link
                            to={schoolDocumentsLink(cycle.id, school.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            Documentos
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-7">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Bloqueantes y observaciones recientes</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Issues reales detectados a partir de las revisiones guardadas.
                  </p>
                </div>

                <MiniBadge tone="slate">{`${issues.length} issues abiertas`}</MiniBadge>
              </div>

              <div className="mt-4 fni-data-table-shell">
                <div className="fni-data-table-scroll">
                  <table className="fni-data-table">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-sm text-slate-600">
                        <th className="px-4 py-3 font-medium">Colegio</th>
                        <th className="px-4 py-3 font-medium">Indicador</th>
                        <th className="px-4 py-3 font-medium">Estado</th>
                        <th className="px-4 py-3 font-medium">Detalle</th>
                        <th className="px-4 py-3 font-medium">Actualizado</th>
                        <th className="px-4 py-3 font-medium">Acción</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200 bg-white">
                      {issues.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-600">
                            No hay observaciones ni bloqueos abiertos para este ciclo.
                          </td>
                        </tr>
                      ) : (
                        issues.map((issue) => (
                          <tr key={`${issue.schoolId}-${issue.indicatorId}`} className="text-sm text-slate-700">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">
                                {normalizeSchoolName(normalizeSchoolCode(issue.schoolCode), issue.schoolName)}
                              </div>
                              <div className="text-xs text-slate-500">{normalizeSchoolCode(issue.schoolCode)}</div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{issue.indicatorCode}</div>
                              <div className="text-xs text-slate-500">{issue.indicatorName}</div>
                            </td>

                            <td className="px-4 py-3">
                              <MiniBadge tone={issue.reviewStatus === "bloqueado" ? "rose" : "amber"}>
                                {issue.reviewStatus === "bloqueado" ? "Bloqueado" : "Observado"}
                              </MiniBadge>
                            </td>

                            <td className="px-4 py-3">{issue.detail}</td>
                            <td className="px-4 py-3 text-slate-500">{formatRelative(issue.reviewedAt)}</td>

                            <td className="px-4 py-3">
                              <Link
                                to={issueLink(cycle.id, issue)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                              >
                                Revisar
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Avance por colegio</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Comparativa real para detectar rezagos y priorizar seguimiento.
                </p>
              </div>

              <Link
                to={`${ROUTES.foundation.schools}?cycleId=${encodeURIComponent(cycleId)}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Abrir colegios
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
              {[...schools]
                .sort((left, right) => left.completionPct - right.completionPct)
                .map((school) => {
                  const schoolCode = normalizeSchoolCode(school.code);
                  const displayName = normalizeSchoolName(schoolCode, school.name);

                  return (
                    <div key={school.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{displayName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {schoolCode} / Última actividad {formatRelative(school.lastActivityAt)}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {school.blockingCount > 0 && (
                            <MiniBadge tone="rose">Bloqueados: {school.blockingCount}</MiniBadge>
                          )}
                          {school.observedCount > 0 && (
                            <MiniBadge tone="amber">Observados: {school.observedCount}</MiniBadge>
                          )}
                          {school.pendingCount > 0 && (
                            <MiniBadge tone="blue">En revisión: {school.pendingCount}</MiniBadge>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                          <span>Avance</span>
                          <span>{school.completionPct}%</span>
                        </div>

                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${barTone(school.completionPct)}`}
                            style={{ width: `${school.completionPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useResolvedAuthUser({ requireSession: true });
  const mode: ManagementDashboardMode = hasRole(user, "ADMIN") ? "admin" : "foundation";

  return <ManagementDashboard mode={mode} />;
}

