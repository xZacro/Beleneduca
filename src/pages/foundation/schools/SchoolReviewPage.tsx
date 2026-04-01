import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  deleteIndicatorDocument,
  getUploadedPdfHref,
  openUploadedPdf,
  uploadIndicatorDocument,
} from "../../../shared/fni/documentClient";
import { calcIndicatorPct, isIndicatorVisible, isQuestionVisible, statusFromPct } from "../../../shared/fni/logic";
import {
  AREAS_SCHEMA,
  type AreaSchema,
  type IndicatorSchema,
} from "../../../shared/fni/schema/evaluacionSchema";
import {
  defaultIndicatorResponse,
  defaultIndicatorReview,
  type IndicatorCompletionStatus,
  type IndicatorResponse,
  type IndicatorReview,
  type ReviewMap,
  type ReviewStatus,
} from "../../../shared/fni/types";
import { useFniWorkspace } from "../../../shared/fni/useFniWorkspace";
import { useCycleOptions } from "../../../shared/useCycleOptions";
import { useFoundationSchoolDisplayName } from "../../../shared/useSchoolDirectory";

// Pantalla de revision: cruza respuestas, evidencia y estado de revision por indicador.
type ReviewRow = {
  areaId: string;
  areaName: string;
  indicator: IndicatorSchema;
  response: IndicatorResponse;
  review: IndicatorReview;
  pct: number | null;
  completionStatus: IndicatorCompletionStatus;
};

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="fni-page-title">{title}</h1>
      {subtitle && <p className="fni-page-subtitle">{subtitle}</p>}
    </div>
  );
}

function Crumb({ schoolLabel }: { schoolLabel: string }) {
  return (
    <div className="text-sm text-slate-600">
      <Link className="hover:underline" to="/foundation/schools">
        Colegios
      </Link>
      <span className="mx-2">/</span>
      <span className="font-medium text-slate-900">{schoolLabel}</span>
      <span className="mx-2">/</span>
      <span>Revisión</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  tone?: "slate" | "amber" | "green" | "red";
}) {
  const toneMap = {
    slate: "border-slate-200 bg-white text-slate-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    red: "border-rose-200 bg-rose-50 text-rose-900",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneMap[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "amber" | "green" | "red" | "blue";
}) {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-rose-100 text-rose-800",
    blue: "bg-blue-100 text-blue-800",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneMap[tone]}`}>
      {children}
    </span>
  );
}

function reviewStatusLabel(status: ReviewStatus) {
  if (status === "aprobado") return "Aprobado";
  if (status === "observado") return "Observado";
  if (status === "bloqueado") return "Bloqueado";
  return "Pendiente";
}

function formatAnswerValue(value: IndicatorResponse["answers"][string]) {
  if (value === undefined || value === null) return "-";
  return String(value);
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

function reviewTone(status: ReviewStatus): "slate" | "green" | "amber" | "red" {
  if (status === "aprobado") return "green";
  if (status === "observado") return "amber";
  if (status === "bloqueado") return "red";
  return "slate";
}

function completionTone(status: IndicatorCompletionStatus): "slate" | "green" | "amber" {
  if (status === "completo") return "green";
  if (status === "incompleto") return "amber";
  return "slate";
}

function completionLabel(status: IndicatorCompletionStatus) {
  if (status === "completo") return "Completo";
  if (status === "incompleto") return "Incompleto";
  return "Pendiente";
}

type SchoolReviewWorkspaceProps = {
  schoolId: string;
  cycleId: string;
  search: string;
  areaFilter: string;
  reviewFilter: string;
  completionFilter: string;
  selectedIndicatorId: string;
  searchParams: URLSearchParams;
  setSearchParams: (
    nextInit: URLSearchParams,
    navigateOptions?: { replace?: boolean }
  ) => void;
};

function SchoolReviewWorkspace({
  schoolId,
  cycleId,
  search,
  areaFilter,
  reviewFilter,
  completionFilter,
  selectedIndicatorId,
  searchParams,
  setSearchParams,
}: SchoolReviewWorkspaceProps) {
  const schoolLabelParam = searchParams.get("schoolLabel");
  const { schoolLabel } = useFoundationSchoolDisplayName(schoolId, cycleId);
  const resolvedSchoolLabel = schoolLabelParam?.trim() || schoolLabel;
  const { cycles, loading: cyclesLoading } = useCycleOptions(cycleId);
  const { workspace, loading, error, setReviews, setResponses } = useFniWorkspace({
    schoolId,
    cycleId,
  });
  const responses = useMemo<Record<string, IndicatorResponse>>(
    () => workspace?.responses ?? {},
    [workspace]
  );
  const reviews = useMemo<ReviewMap>(() => workspace?.reviews ?? {}, [workspace]);
  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === cycleId) ?? null,
    [cycleId, cycles]
  );
  const cycleLocked = selectedCycle?.isClosed ?? false;
  const canManageEvidence = !cycleLocked;

  const rows = useMemo<ReviewRow[]>(() => {
    // Construimos una vista plana para filtrar y revisar por indicador sin tocar el schema.
    return AREAS_SCHEMA.flatMap((area: AreaSchema) =>
      area.indicators
        .filter((indicator) => isIndicatorVisible(indicator, responses))
        .map((indicator) => {
          const response = responses[indicator.id] ?? defaultIndicatorResponse();
          const review = reviews[indicator.id] ?? defaultIndicatorReview();
          const pct = calcIndicatorPct(indicator, response);
          const completionStatus = statusFromPct(pct);

          return {
            areaId: area.id,
            areaName: area.name,
            indicator,
            response,
            review,
            pct,
            completionStatus,
          };
        })
    );
  }, [responses, reviews]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !term ||
        row.areaName.toLowerCase().includes(term) ||
        row.indicator.name.toLowerCase().includes(term) ||
        row.response.documentRef.toLowerCase().includes(term) ||
        row.response.comments.toLowerCase().includes(term) ||
        row.review.reviewComment.toLowerCase().includes(term);

      const matchesArea = areaFilter === "all" || row.areaId === areaFilter;
      const matchesReview = reviewFilter === "all" || row.review.status === reviewFilter;
      const matchesCompletion = completionFilter === "all" || row.completionStatus === completionFilter;
      const matchesIndicator = !selectedIndicatorId || row.indicator.id === selectedIndicatorId;

      return matchesSearch && matchesArea && matchesReview && matchesCompletion && matchesIndicator;
    });
  }, [rows, search, areaFilter, reviewFilter, completionFilter, selectedIndicatorId]);

  const summary = useMemo(() => {
    const total = rows.length;
    const pendientes = rows.filter((row) => row.review.status === "pendiente").length;
    const aprobados = rows.filter((row) => row.review.status === "aprobado").length;
    const observados = rows.filter((row) => row.review.status === "observado").length;
    const bloqueados = rows.filter((row) => row.review.status === "bloqueado").length;

    return { total, pendientes, aprobados, observados, bloqueados };
  }, [rows]);

  const updateParams = (updater: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    updater(next);
    next.set("cycleId", cycleId);
    setSearchParams(next, { replace: true });
  };

  const setParam = (key: string, value: string) => {
    updateParams((next) => {
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
    });
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    next.set("cycleId", cycleId);
    setSearchParams(next, { replace: true });
  };

  const updateReview = (indicatorId: string, patch: Partial<IndicatorReview>) => {
    if (cycleLocked) return;

    // El estado de revision siempre pisa con reviewedAt nuevo para mantener trazabilidad.
    void setReviews((prev) => ({
      ...prev,
      [indicatorId]: {
        ...(prev[indicatorId] ?? defaultIndicatorReview()),
        ...patch,
        reviewedAt: new Date().toISOString(),
        reviewedBy: "Fundación",
      },
    }));
  };

  const updateEvidence = async (
    indicator: IndicatorSchema,
    response: IndicatorResponse,
    nextFile: File | null
  ) => {
    if (!canManageEvidence) return;

    const uploadMoment = new Date();
    const ref = { schoolId, cycleId };

    try {
      if (!nextFile) {
        if (response.file?.id) {
          await deleteIndicatorDocument(response.file.id);
        }

        await setResponses((current) => ({
          ...current,
          [indicator.id]: {
            ...response,
            file: null,
            updatedAt: uploadMoment.toISOString(),
          },
        }));
        return;
      }

      const uploadedFile = await uploadIndicatorDocument(ref, indicator.id, nextFile, response.file, {
        indicatorName: indicator.name,
        schoolCode: schoolId,
        uploadedAt: uploadMoment,
      });

      await setResponses((current) => ({
        ...current,
        [indicator.id]: {
          ...response,
          file: uploadedFile,
          updatedAt: uploadMoment.toISOString(),
        },
      }));
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "No se pudo actualizar el archivo.";
      window.alert(message);
    }
  };

  const formHref = `/foundation/schools/${encodeURIComponent(
    schoolId
  )}/form?cycleId=${encodeURIComponent(cycleId)}`;
  const documentsBaseHref = `/foundation/schools/${encodeURIComponent(
    schoolId
  )}/documents?cycleId=${encodeURIComponent(cycleId)}`;

  return (
    <div className="fni-page-shell">
      <Crumb schoolLabel={resolvedSchoolLabel} />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SectionTitle
          title={`Revisión - ${resolvedSchoolLabel}`}
          subtitle="Revisión consistente con las mismas reglas que usa la vista de colegio."
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cycleId}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              next.set("cycleId", event.target.value);
              setSearchParams(next, { replace: true });
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

          <Link to={formHref} className="fni-toolbar-button">
            Volver al formulario
          </Link>

          <Link to={documentsBaseHref} className="fni-toolbar-button">
            Ver documentos
          </Link>
        </div>
      </div>

      <div className="fni-data-panel p-4 text-sm text-slate-600">
        Revisión activa · {summary.aprobados} aprobados · {summary.observados} observados · {summary.bloqueados} bloqueados
      </div>

      {loading && !workspace && (
        <div className="fni-data-panel p-6 text-sm text-slate-600">
          Cargando revisión...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      {cycleLocked && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {selectedCycle?.name ?? `Ciclo ${cycleId}`} está cerrado. La revisión queda disponible solo en modo
          lectura.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <StatCard label="Total indicadores" value={summary.total} />
        <StatCard label="Pendientes" value={summary.pendientes} tone="slate" />
        <StatCard label="Aprobados" value={summary.aprobados} tone="green" />
        <StatCard label="Observados" value={summary.observados} tone="amber" />
        <StatCard label="Bloqueados" value={summary.bloqueados} tone="red" />
      </div>

      <div className="fni-data-panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-4">
            <label className="fni-field-label">Buscar</label>
            <input
              value={search}
              onChange={(event) => setParam("q", event.target.value)}
              placeholder="Indicador, área, documento, comentario..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="md:col-span-3">
            <label className="fni-field-label">Área</label>
            <select
              value={areaFilter}
              onChange={(event) => setParam("area", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
            >
              <option value="all">Todas</option>
              {AREAS_SCHEMA.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="fni-field-label">Estado de revisión</label>
            <select
              value={reviewFilter}
              onChange={(event) => setParam("reviewStatus", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
            >
              <option value="all">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="observado">Observado</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="fni-field-label">Completitud</label>
            <select
              value={completionFilter}
              onChange={(event) => setParam("completion", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
            >
              <option value="all">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="completo">Completo</option>
              <option value="incompleto">Incompleto</option>
            </select>
          </div>

          <div className="md:col-span-1">
            <button type="button" onClick={clearFilters} className="w-full fni-toolbar-button">
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRows.length === 0 ? (
          <div className="fni-empty-state-panel">
            No se encontraron indicadores para los filtros aplicados.
          </div>
        ) : (
          filteredRows.map((row) => (
            <div
              key={row.indicator.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                row.indicator.id === selectedIndicatorId ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"
              }`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">{row.areaName}</Badge>
                    <Badge tone={completionTone(row.completionStatus)}>
                      {`Formulario: ${completionLabel(row.completionStatus)}`}
                    </Badge>
                    <Badge tone={reviewTone(row.review.status)}>
                      {`Revisión: ${reviewStatusLabel(row.review.status)}`}
                    </Badge>
                    {row.pct != null && <Badge tone="slate">Obtenido: {row.pct.toFixed(2)}%</Badge>}
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-slate-900">{row.indicator.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    ID: {row.indicator.id} / Última actualización colegio: {formatDate(row.response.updatedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {getUploadedPdfHref(row.response.file) ? (
                    <button
                      type="button"
                      onClick={() => openUploadedPdf(row.response.file)}
                      className="fni-toolbar-button"
                    >
                      Ver documento
                    </button>
                  ) : row.response.documentRef.trim() || row.response.comments.trim() ? (
                    <Link
                      to={`${documentsBaseHref}&indicatorId=${encodeURIComponent(row.indicator.id)}`}
                      className="fni-toolbar-button"
                    >
                      Ver documento
                    </Link>
                  ) : (
                    <span className="inline-flex cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500">
                      Sin documento
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Respuestas del colegio</div>

                    <div className="mt-3 space-y-2">
                      {row.indicator.questions
                        .filter((question) => isQuestionVisible(question, row.response.answers))
                        .map((question) => (
                          <div key={question.key} className="text-sm">
                            <div className="font-medium text-slate-700">{question.label}</div>
                            <div className="text-slate-600">
                              {formatAnswerValue(row.response.answers[question.key])}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Evidencia y comentario</div>

                    <div className="mt-3 space-y-3 text-sm">
                      <div>
                        <div className="font-medium text-slate-700">Documento</div>
                        <div className="break-words text-slate-600">
                          {row.response.documentRef.trim() ? row.response.documentRef : "-"}
                        </div>
                      </div>

                      <div>
                        <div className="font-medium text-slate-700">Comentario colegio</div>
                        <div className="whitespace-pre-wrap text-slate-600">
                          {row.response.comments.trim() ? row.response.comments : "-"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        PDF de soporte
                      </div>

                      {getUploadedPdfHref(row.response.file) ? (
                        <div className="mt-2 space-y-2">
                          <div className="break-words text-sm font-medium text-slate-800">
                            {row.response.file?.name ?? "Documento adjunto"}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {row.response.file && (
                              <button
                                type="button"
                                onClick={() => openUploadedPdf(row.response.file)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                              >
                                Ver PDF
                              </button>
                            )}

                            {canManageEvidence && row.response.file?.id && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updateEvidence(row.indicator, row.response, null);
                                }}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
                              >
                                Quitar PDF
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {canManageEvidence ? (
                            <>
                              <input
                                type="file"
                                accept="application/pdf"
                                className="block w-full text-sm"
                                onChange={async (event) => {
                                  const file = event.target.files?.[0] ?? null;
                                  await updateEvidence(row.indicator, row.response, file);
                                  event.currentTarget.value = "";
                                }}
                              />
                              <p className="text-xs text-slate-500">
                                Fundación y administración pueden adjuntar aquí el respaldo PDF de este indicador.
                              </p>
                            </>
                          ) : (
                            <div className="text-sm text-slate-500">Sin PDF adjunto.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Revisión Fundación / Admin</div>

                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Estado de revisión</label>
                        <select
                          value={row.review.status}
                          disabled={cycleLocked}
                          onChange={(event) =>
                            updateReview(row.indicator.id, {
                              status: event.target.value as ReviewStatus,
                            })
                          }
                          className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                            cycleLocked ? "cursor-not-allowed bg-slate-50 text-slate-500" : "bg-white"
                          }`}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="aprobado">Aprobado</option>
                          <option value="observado">Observado</option>
                          <option value="bloqueado">Bloqueado</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600">Comentario de revisión</label>
                        <textarea
                          value={row.review.reviewComment}
                          disabled={cycleLocked}
                          onChange={(event) =>
                            updateReview(row.indicator.id, {
                              reviewComment: event.target.value,
                            })
                          }
                          rows={4}
                          placeholder="Observaciones, hallazgos, bloqueo, solicitud de ajuste..."
                          className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 ${
                            cycleLocked ? "cursor-not-allowed bg-slate-50 text-slate-500" : "bg-white"
                          }`}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <button
                          type="button"
                          disabled={cycleLocked}
                          onClick={() => updateReview(row.indicator.id, { status: "aprobado" })}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                            cycleLocked
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          }`}
                        >
                          Aprobar
                        </button>

                        <button
                          type="button"
                          disabled={cycleLocked}
                          onClick={() => updateReview(row.indicator.id, { status: "observado" })}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                            cycleLocked
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                              : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          }`}
                        >
                          Observar
                        </button>

                        <button
                          type="button"
                          disabled={cycleLocked}
                          onClick={() => updateReview(row.indicator.id, { status: "bloqueado" })}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                            cycleLocked
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                              : "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                          }`}
                        >
                          Bloquear
                        </button>
                      </div>

                      <div className="text-xs text-slate-500">
                        Revisado por: {row.review.reviewedBy ?? "-"} / Última revisión:{" "}
                        {formatDate(row.review.reviewedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function SchoolReviewPage() {
  const { schoolId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const cycleId = searchParams.get("cycleId") ?? "2026";
  const search = searchParams.get("q") ?? "";
  const areaFilter = searchParams.get("area") ?? "all";
  const reviewFilter = searchParams.get("reviewStatus") ?? "all";
  const completionFilter = searchParams.get("completion") ?? "all";
  const selectedIndicatorId = searchParams.get("indicator") ?? "";

  return (
    <SchoolReviewWorkspace
      key={`${schoolId}:${cycleId}`}
      schoolId={schoolId}
      cycleId={cycleId}
      search={search}
      areaFilter={areaFilter}
      reviewFilter={reviewFilter}
      completionFilter={completionFilter}
      selectedIndicatorId={selectedIndicatorId}
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
}
