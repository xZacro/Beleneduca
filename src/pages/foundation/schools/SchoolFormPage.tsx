import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  AREAS_SCHEMA,
  type AreaSchema,
  type IndicatorSchema,
  type Question,
  type YesNoNA,
} from "../../../shared/fni/schema/evaluacionSchema";
import {
  calcIndicatorPct,
  isQuestionVisible,
  pruneHiddenAnswers,
  statusFromPct,
} from "../../../shared/fni/logic";
import { defaultIndicatorResponse, type IndicatorResponse } from "../../../shared/fni/types";
import { useFniWorkspace } from "../../../shared/fni/useFniWorkspace";
import { useCycleOptions } from "../../../shared/useCycleOptions";
import { useFoundationSchoolDisplayName } from "../../../shared/useSchoolDirectory";

// Formulario operativo de fundacion: permite navegar por areas, indicadores y estados derivados.
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
      <span className="text-slate-900 font-medium">{schoolLabel}</span>
      <span className="mx-2">/</span>
      <span>Formulario</span>
    </div>
  );
}

function StatusBadge({ pct }: { pct: number | null }) {
  const status = statusFromPct(pct);
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border";

  if (status === "completo") {
    return (
      <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}>
        Completo
      </span>
    );
  }

  if (status === "incompleto") {
    return (
      <span className={`${base} bg-rose-50 text-rose-700 border-rose-200`}>
        Incompleto
      </span>
    );
  }

  return (
    <span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}>
      Pendiente
    </span>
  );
}

function YesNoNAControl({
  value,
  disabled,
  onChange,
}: {
  value: YesNoNA | undefined;
  disabled?: boolean;
  onChange: (value: YesNoNA | undefined) => void;
}) {
  const buttonBase = "px-3 py-1.5 rounded-lg text-sm border transition";

  const activeClassFor = (option: YesNoNA) => {
    if (option === "SI") return "border-emerald-600 bg-emerald-600 text-white";
    if (option === "NO") return "border-rose-600 bg-rose-600 text-white";
    return "border-amber-500 bg-amber-500 text-white";
  };

  const renderOption = (option: YesNoNA, label: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(value === option ? undefined : option)}
      className={`${buttonBase} ${
        value === option
          ? activeClassFor(option)
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""} focus:outline-none focus:ring-2 focus:ring-slate-200`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex gap-2">
      {renderOption("SI", "Sí")}
      {renderOption("NO", "No")}
      {renderOption("NA", "N/A")}
    </div>
  );
}

function NumberControl({
  value,
  disabled,
  onChange,
  min,
  max,
}: {
  value: number | undefined;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value;
        if (!raw) {
          onChange(undefined);
          return;
        }

        const parsed = Number(raw);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
      className={`w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 ${
        disabled ? "cursor-not-allowed bg-slate-50 text-slate-500" : "bg-white"
      }`}
    />
  );
}

function IndicatorCard({
  indicator,
  response,
  highlighted,
  disabled,
  onUpdate,
}: {
  indicator: IndicatorSchema;
  response: IndicatorResponse;
  highlighted: boolean;
  disabled: boolean;
  onUpdate: (next: IndicatorResponse) => void;
}) {
  const pct = calcIndicatorPct(indicator, response);
  const visibleQuestions = indicator.questions.filter((question) =>
    isQuestionVisible(question, response.answers)
  );

  const updateAnswers = (question: Question, value: YesNoNA | number | undefined) => {
    // Eliminamos respuestas ocultas para no arrastrar datos inconsistentes entre dependencias.
    const nextAnswers = pruneHiddenAnswers(indicator, {
      ...response.answers,
      [question.key]: value,
    });

    onUpdate({
      ...response,
      answers: nextAnswers,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        highlighted ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"
      }`}
      id={`indicator-${indicator.id}`}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{indicator.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <StatusBadge pct={pct} />
            <span className="rounded-full border border-slate-200 px-2 py-0.5">
              Esperado: {indicator.expectedPct.toFixed(0)}%
            </span>
            <span className="rounded-full border border-slate-200 px-2 py-0.5">
              Obtenido: {pct == null ? "-" : `${pct.toFixed(1)}%`}
            </span>
            {response.updatedAt && (
              <span className="text-slate-400">
                Actualizado: {new Date(response.updatedAt).toLocaleString("es-CL")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {visibleQuestions.map((question) => (
          <div
            key={question.key}
            className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
          >
            <div className="text-sm text-slate-800">{question.label}</div>

            {question.kind === "yesno" ? (
              <YesNoNAControl
                value={
                  typeof response.answers[question.key] === "number"
                    ? undefined
                    : (response.answers[question.key] as YesNoNA | undefined)
                }
                disabled={disabled}
                onChange={(value) => updateAnswers(question, value)}
              />
            ) : (
              <NumberControl
                value={
                  typeof response.answers[question.key] === "number"
                    ? (response.answers[question.key] as number)
                    : undefined
                }
                min={question.min}
                max={question.max}
                disabled={disabled}
                onChange={(value) => updateAnswers(question, value)}
              />
            )}
          </div>
        ))}

        {indicator.hasDocumentFields && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-600">
                Documento (referencia)
              </label>
              <input
                disabled={disabled}
                value={response.documentRef}
                onChange={(event) =>
                  onUpdate({
                    ...response,
                    documentRef: event.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                placeholder='Ej: "Nro. 48 del 10/02/2003" / "Página 168" / "En papel"'
                className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 ${
                  disabled ? "cursor-not-allowed bg-slate-50 text-slate-500" : "bg-white"
                }`}
              />
            </div>

            <div className="md:col-span-7">
              <label className="block text-xs font-medium text-slate-600">Comentarios</label>
              <input
                disabled={disabled}
                value={response.comments}
                onChange={(event) =>
                  onUpdate({
                    ...response,
                    comments: event.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                placeholder="Observaciones, contexto, pendientes..."
                className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 ${
                  disabled ? "cursor-not-allowed bg-slate-50 text-slate-500" : "bg-white"
                }`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type SchoolFormWorkspaceProps = {
  schoolId: string;
  cycleId: string;
  view: string;
  search: string;
  activeAreaId: string;
  highlightedIndicatorId: string;
  searchParams: URLSearchParams;
  setSearchParams: (
    nextInit: URLSearchParams,
    navigateOptions?: { replace?: boolean }
  ) => void;
};

function SchoolFormWorkspace({
  schoolId,
  cycleId,
  view,
  search,
  activeAreaId,
  highlightedIndicatorId,
  searchParams,
  setSearchParams,
}: SchoolFormWorkspaceProps) {
  const schoolLabelParam = searchParams.get("schoolLabel");
  const { schoolLabel } = useFoundationSchoolDisplayName(schoolId, cycleId);
  const resolvedSchoolLabel = schoolLabelParam?.trim() || schoolLabel;
  const { cycles, loading: cyclesLoading } = useCycleOptions(cycleId);
  const { workspace, loading, error, setResponses } = useFniWorkspace({
    schoolId,
    cycleId,
  });
  const responses = useMemo<Record<string, IndicatorResponse>>(
    () => workspace?.responses ?? {},
    [workspace]
  );
  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === cycleId) ?? null,
    [cycleId, cycles]
  );
  const cycleLocked = selectedCycle?.isClosed ?? false;

  const activeArea: AreaSchema | undefined =
    AREAS_SCHEMA.find((area) => area.id === activeAreaId) ?? AREAS_SCHEMA[0];

  const tabs = useMemo(
    () => [
      { key: "areas", label: "Por áreas" },
      { key: "indicators", label: "Por indicadores" },
      { key: "activity", label: "Historial" },
    ],
    []
  );

  const updateParams = (updater: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    updater(next);
    next.set("cycleId", cycleId);
    if (!next.has("view")) next.set("view", view);
    if (!next.has("area")) next.set("area", activeAreaId);
    setSearchParams(next, { replace: true });
  };

  const setTab = (nextView: string) => {
    updateParams((next) => {
      next.set("view", nextView);
    });
  };

  const setCycle = (nextCycleId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("cycleId", nextCycleId);
    next.set("view", view);
    next.set("area", activeAreaId);
    setSearchParams(next, { replace: true });
  };

  const setSearch = (value: string) => {
    updateParams((next) => {
      if (value) next.set("q", value);
      else next.delete("q");
    });
  };

  const setArea = (nextAreaId: string) => {
    updateParams((next) => {
      next.set("area", nextAreaId);
      next.delete("indicator");
    });
  };

  const filteredIndicators = useMemo(() => {
    if (!activeArea) return [];

    const term = search.trim().toLowerCase();
    let indicators = activeArea.indicators;

    // Este filtro solo mira el area activa y el texto buscado.
    if (highlightedIndicatorId) {
      indicators = indicators.filter((indicator) => indicator.id === highlightedIndicatorId);
    }

    if (!term) return indicators;
    return indicators.filter((indicator) => indicator.name.toLowerCase().includes(term));
  }, [activeArea, highlightedIndicatorId, search]);

  const areaStats = useMemo(() => {
    if (!activeArea) return { total: 0, completos: 0, incompletos: 0, pendientes: 0, conPdf: 0 };

    let completos = 0;
    let incompletos = 0;
    let pendientes = 0;
    let conPdf = 0;

    for (const indicator of activeArea.indicators) {
      const response = responses[indicator.id] ?? defaultIndicatorResponse();
      const status = statusFromPct(calcIndicatorPct(indicator, response));
      if (response.file) conPdf++;

      if (status === "completo") completos++;
      else if (status === "incompleto") incompletos++;
      else pendientes++;
    }

    return { total: activeArea.indicators.length, completos, incompletos, pendientes, conPdf };
  }, [activeArea, responses]);

  const documentsHref = `/foundation/schools/${encodeURIComponent(
    schoolId
  )}/documents?cycleId=${encodeURIComponent(cycleId)}`;
  const reviewHref = `/foundation/schools/${encodeURIComponent(
    schoolId
  )}/review?cycleId=${encodeURIComponent(cycleId)}`;

  return (
    <div className="fni-page-shell">
      <Crumb schoolLabel={resolvedSchoolLabel} />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SectionTitle
          title={`Formulario - ${resolvedSchoolLabel}`}
          subtitle="Captura por ciclo con evidencia PDF y validación compartida."
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cycleId}
            onChange={(event) => setCycle(event.target.value)}
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

          <Link to={documentsHref} className="fni-toolbar-button">
            Ver documentos
          </Link>

          <Link to={reviewHref} className="fni-toolbar-button-primary">
            Ir a revisión
          </Link>
        </div>
      </div>

      <div className="fni-data-panel p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`fni-tab-button ${view === tab.key ? "fni-tab-button-active" : ""}`}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {view === "areas" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <div className="fni-data-panel p-3">
              <div className="fni-menu-label">Áreas</div>

              <div className="space-y-1">
                {AREAS_SCHEMA.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setArea(area.id)}
                    className={`fni-menu-item ${activeAreaId === area.id ? "fni-menu-item-active" : ""}`}
                  >
                    {area.name}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <div className="text-xs font-semibold text-slate-600">Resumen del área</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-xs text-slate-500">Total</div>
                    <div className="font-semibold text-slate-900">{areaStats.total}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <div className="text-xs text-emerald-700">Completos</div>
                    <div className="font-semibold text-emerald-900">{areaStats.completos}</div>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-2">
                    <div className="text-xs text-rose-700">Incompletos</div>
                    <div className="font-semibold text-rose-900">{areaStats.incompletos}</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2">
                    <div className="text-xs text-amber-800">Pendientes</div>
                    <div className="font-semibold text-amber-900">{areaStats.pendientes}</div>
                  </div>
                </div>

              <div className="mt-3 text-xs text-slate-500">
                {areaStats.conPdf} de {areaStats.total} indicadores de esta área ya tienen PDF adjunto.
              </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-9 space-y-3">
            <div className="fni-data-panel p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{activeArea?.name}</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Indicadores disponibles para este ciclo y esta área.
                  </p>
                </div>

                <div className="w-full md:w-80">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar indicador..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              </div>
            </div>

            {loading && !workspace && (
              <div className="fni-data-panel p-6 text-sm text-slate-600">
                Cargando formulario...
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {error}
              </div>
            )}

            {cycleLocked && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                {selectedCycle?.name ?? `Ciclo ${cycleId}`} está cerrado. El formulario queda disponible solo en
                modo lectura.
              </div>
            )}

            {filteredIndicators.map((indicator) => {
              const response = responses[indicator.id] ?? defaultIndicatorResponse();

              return (
                <IndicatorCard
                  key={indicator.id}
                  indicator={indicator}
                  response={response}
                  highlighted={indicator.id === highlightedIndicatorId}
                  disabled={cycleLocked}
                  onUpdate={(next) => {
                    if (cycleLocked) return;

                    void setResponses((prev) => ({
                      ...prev,
                      [indicator.id]: next,
                    }));
                  }}
                />
              );
            })}

            {!filteredIndicators.length && (
              <div className="fni-empty-state-panel">
                No se encontraron indicadores con ese filtro.
              </div>
            )}
          </div>
        </div>
      )}

      {view === "indicators" && (
        <div className="fni-data-panel">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-900">Por indicadores</div>
              <p className="mt-1 text-sm text-slate-600">
                Vista preparada para evolucionar a una tabla global de seguimiento.
              </p>
            </div>

            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              Próximo paso
            </span>
          </div>

          <div className="mt-4 fni-data-table-shell">
            <div className="fni-data-table-scroll">
              <table className="fni-data-table">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Indicador</th>
                    <th className="px-4 py-3 text-left font-semibold">Área</th>
                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                    <th className="px-4 py-3 text-left font-semibold">Fuente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td className="px-4 py-4 text-slate-700">Indicadores del ciclo activo</td>
                    <td className="px-4 py-4 text-slate-700">Área seleccionada</td>
                    <td className="px-4 py-4 text-slate-700">Listado navegable</td>
                    <td className="px-4 py-4 text-slate-700">Disponible para consulta y edición</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === "activity" && (
        <div className="fni-data-panel">
          <div className="text-lg font-semibold text-slate-900">Historial del ciclo</div>
          <p className="mt-1 text-sm text-slate-600">
            Aquí podrás seguir los cambios de cada indicador mientras avanzas en el formulario.
          </p>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            El historial detallado aparecerá a medida que guardes respuestas y se registren revisiones.
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchoolFormPage() {
  const { schoolId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const cycleId = searchParams.get("cycleId") ?? "2026";
  const view = searchParams.get("view") ?? "areas";
  const search = searchParams.get("q") ?? "";
  const activeAreaId = searchParams.get("area") ?? AREAS_SCHEMA[0]?.id ?? "";
  const highlightedIndicatorId = searchParams.get("indicator") ?? "";

  return (
    <SchoolFormWorkspace
      key={`${schoolId}:${cycleId}`}
      schoolId={schoolId}
      cycleId={cycleId}
      view={view}
      search={search}
      activeAreaId={activeAreaId}
      highlightedIndicatorId={highlightedIndicatorId}
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
}
