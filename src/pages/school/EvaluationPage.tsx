import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getUser } from "../../shared/auth";
import {
  AREAS_SCHEMA,
  type AreaSchema,
  type IndicatorSchema,
  type YesNoNA,
} from "../../shared/fni/schema/evaluacionSchema";
import {
  calcIndicatorPct,
  isIndicatorVisible,
  isQuestionVisible,
  pruneHiddenAnswers,
  statusFromPct,
} from "../../shared/fni/logic";
import {
  deleteIndicatorDocument,
  getUploadedPdfHref,
  uploadIndicatorDocument,
} from "../../shared/fni/documentClient";
import { getIndicatorDocumentStem } from "../../shared/fni/documentNaming";
import {
  defaultIndicatorResponse,
  defaultSubmissionRecord,
  type IndicatorReview,
  type IndicatorResponse,
  type ReviewMap,
  type SchoolCycleRef,
  type SubmissionRecord,
  type SubmissionStatus,
} from "../../shared/fni/types";
import { useFniWorkspace } from "../../shared/fni/useFniWorkspace";
import { useCycleOptions } from "../../shared/useCycleOptions";
import { resolveSchoolDirectoryEntry, useSchoolDirectory, useSchoolDisplayName } from "../../shared/useSchoolDirectory";

// Vista principal del colegio: edicion de respuestas, evidencia PDF y estado de envio.
function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function completionTone(status: "pendiente" | "completo" | "incompleto") {
  if (status === "completo") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "incompleto") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function reviewTone(status: IndicatorReview["status"]) {
  if (status === "aprobado") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "observado") return "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "bloqueado") return "bg-rose-50 text-rose-800 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function submissionTone(status: SubmissionStatus) {
  if (status === "aprobado") return "bg-emerald-50 text-emerald-900 border-emerald-200";
  if (status === "devuelto") return "bg-amber-50 text-amber-900 border-amber-200";
  if (status === "enviado") return "bg-blue-50 text-blue-900 border-blue-200";
  return "bg-slate-50 text-slate-900 border-slate-200";
}

function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function YesNoControl({
  value,
  disabled,
  onChange,
}: {
  value?: YesNoNA;
  disabled?: boolean;
  onChange: (value: YesNoNA | undefined) => void;
}) {
  const options: YesNoNA[] = ["SI", "NO", "NA"];

  const activeTone = (option: YesNoNA) => {
    if (option === "SI") return "border-emerald-600 bg-emerald-600 text-white";
    if (option === "NO") return "border-rose-600 bg-rose-600 text-white";
    return "border-amber-500 bg-amber-500 text-white";
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option;

        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(active ? undefined : option)}
            className={`rounded-lg border px-4 py-2 text-sm transition ${
              active
                ? activeTone(option)
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""} focus:outline-none focus:ring-2 focus:ring-slate-200`}
          >
            {option === "SI" ? "Sí" : option}
          </button>
        );
      })}
    </div>
  );
}

function NumberControl({
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  value?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value?: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step="0.01"
      disabled={disabled}
      value={typeof value === "number" ? value : ""}
      onChange={(event) => {
        const raw = event.target.value.trim();
        if (!raw) onChange(undefined);
        else onChange(Number(raw));
      }}
      className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 ${
        disabled ? "cursor-not-allowed bg-slate-50 text-slate-500" : "bg-white"
      }`}
      placeholder="Ingrese valor"
    />
  );
}

function ReviewFeedback({ review }: { review?: IndicatorReview }) {
  if (!review || review.status === "pendiente") return null;

  return (
    <div className={`rounded-xl border p-3 ${reviewTone(review.status)}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">Feedback Fundación / Admin</div>
      <div className="mt-2 text-sm">
        Estado: <b>{review.status}</b>
      </div>
      <div className="mt-1 whitespace-pre-wrap text-sm">
        {review.reviewComment.trim() ? review.reviewComment : "Sin comentario registrado."}
      </div>
      <div className="mt-2 text-xs opacity-80">
        Revisado por: {review.reviewedBy ?? "-"} / {formatDate(review.reviewedAt)}
      </div>
    </div>
  );
}

function IndicatorCard({
  indicator,
  response,
  review,
  disabled,
  highlighted,
  schoolRef,
  schoolCode,
  onUpdate,
}: {
  indicator: IndicatorSchema;
  response: IndicatorResponse;
  review?: IndicatorReview;
  disabled: boolean;
  highlighted: boolean;
  schoolRef: SchoolCycleRef;
  schoolCode: string;
  onUpdate: (next: IndicatorResponse) => void;
}) {
  const pct = calcIndicatorPct(indicator, response);
  const completion = statusFromPct(pct);
  const visibleQuestions = indicator.questions.filter((question) =>
    isQuestionVisible(question, response.answers)
  );
  const fileHref = getUploadedPdfHref(response.file);

  const updateAnswers = (key: string, value: YesNoNA | number | undefined) => {
    // Limpiamos respuestas ocultas para evitar que queden valores viejos en preguntas dependientes.
    const nextAnswers = pruneHiddenAnswers(indicator, {
      ...response.answers,
      [key]: value,
    });

    onUpdate({
      ...response,
      answers: nextAnswers,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        highlighted ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"
      }`}
      id={`indicator-${indicator.id}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge className={completionTone(completion)}>
              {completion === "completo"
                ? "Formulario: Completo"
                : completion === "incompleto"
                ? "Formulario: Incompleto"
                : "Formulario: Pendiente"}
            </Badge>
            <Badge className="bg-slate-50 text-slate-700 border-slate-200">
              Esperado: {indicator.expectedPct}%
            </Badge>
            <Badge className="bg-slate-50 text-slate-700 border-slate-200">
              Obtenido: {pct == null ? "-" : `${pct.toFixed(2)}%`}
            </Badge>
          </div>

          <h3 className="mt-3 text-base font-semibold text-slate-900">{indicator.name}</h3>
          <div className="mt-1 text-xs text-slate-500">
            Última actualización: {formatDate(response.updatedAt)}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {visibleQuestions.map((question) => (
          <div key={question.key}>
            <label className="block text-sm font-medium text-slate-700">{question.label}</label>

            {question.kind === "yesno" ? (
              <div className="mt-2">
                <YesNoControl
                  value={
                    typeof response.answers[question.key] === "number"
                      ? undefined
                      : (response.answers[question.key] as YesNoNA | undefined)
                  }
                  disabled={disabled}
                  onChange={(value) => updateAnswers(question.key, value)}
                />
              </div>
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
                onChange={(value) => updateAnswers(question.key, value)}
              />
            )}
          </div>
        ))}

        {indicator.hasDocumentFields && (
          <>
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
                  placeholder='Ej: "REX 48 / pag. 12 / carpeta fisica"'
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

            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-7">
                <label className="block text-xs font-medium text-slate-600">Adjuntar PDF</label>
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={disabled}
                  className={`mt-1 block w-full text-sm ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;

                    if (file.type !== "application/pdf") {
                      window.alert("Solo se permiten archivos PDF.");
                      event.currentTarget.value = "";
                      return;
                    }

                    try {
                      const uploadMoment = new Date();
                      const uploadedFile = await uploadIndicatorDocument(
                        schoolRef,
                        indicator.id,
                        file,
                        response.file,
                        {
                          indicatorName: getIndicatorDocumentStem(indicator.id, indicator.name),
                          schoolCode,
                          uploadedAt: uploadMoment,
                        }
                      );
                      onUpdate({
                        ...response,
                        file: uploadedFile,
                        updatedAt: uploadMoment.toISOString(),
                      });
                    } catch (error) {
                      const message =
                        error instanceof Error ? error.message : "No se pudo cargar el archivo.";
                      window.alert(message);
                    } finally {
                      event.currentTarget.value = "";
                    }
                  }}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Modo API: el PDF se guarda en el backend local y se descarga desde un endpoint real.
                </p>
              </div>

              <div className="md:col-span-5">
                <label className="block text-xs font-medium text-slate-600">Archivo cargado</label>
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {response.file ? (
                    <div className="space-y-2">
                      <div className="font-medium break-words">{response.file.name}</div>
                      <div className="text-xs text-slate-500">
                        {(response.file.size / 1024).toFixed(1)} KB / {formatDate(response.file.uploadedAt)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {fileHref && (
                          <a
                            href={fileHref}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            Ver PDF
                          </a>
                        )}

                        {!disabled && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                if (response.file?.id) {
                                  await deleteIndicatorDocument(response.file.id);
                                }

                                onUpdate({
                                  ...response,
                                  file: null,
                                  updatedAt: new Date().toISOString(),
                                });
                              } catch (error) {
                                const message =
                                  error instanceof Error
                                    ? error.message
                                    : "No se pudo eliminar el archivo.";
                                window.alert(message);
                              }
                            }}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
                          >
                            Quitar archivo
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500">Sin PDF adjunto.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <ReviewFeedback review={review} />
      </div>
    </div>
  );
}

type EvaluationWorkspaceProps = {
  schoolId: string;
  cycleId: string;
  search: string;
  activeAreaId: string;
  highlightedIndicatorId: string;
  searchParams: URLSearchParams;
  setSearchParams: (
    nextInit: URLSearchParams,
    navigateOptions?: { replace?: boolean }
  ) => void;
};

function EvaluationWorkspace({
  schoolId,
  cycleId,
  search,
  activeAreaId,
  highlightedIndicatorId,
  searchParams,
  setSearchParams,
}: EvaluationWorkspaceProps) {
  const { schoolLabel } = useSchoolDisplayName(schoolId);
  const { schools } = useSchoolDirectory();
  const { cycles, loading: cyclesLoading } = useCycleOptions(cycleId);
  const { workspace, loading, error, setResponses, setSubmission, repository } = useFniWorkspace({
    schoolId,
    cycleId,
  });
  const schoolCode = useMemo(() => {
    const schoolEntry = resolveSchoolDirectoryEntry(schoolId, schools);
    if (schoolEntry?.code) {
      return schoolEntry.code;
    }

    const displayPrefix = schoolLabel.includes(" - ") ? schoolLabel.split(" - ")[0]?.trim() : "";
    return displayPrefix || schoolId;
  }, [schoolId, schoolLabel, schools]);
  const responses = useMemo<Record<string, IndicatorResponse>>(
    () => workspace?.responses ?? {},
    [workspace]
  );
  const submission = useMemo<SubmissionRecord>(
    () => workspace?.submission ?? defaultSubmissionRecord(),
    [workspace]
  );
  const reviews = useMemo<ReviewMap>(() => workspace?.reviews ?? {}, [workspace]);

  const activeArea: AreaSchema | undefined =
    AREAS_SCHEMA.find((area) => area.id === activeAreaId) ?? AREAS_SCHEMA[0];

  const updateParams = (updater: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    updater(next);
    next.set("cycleId", cycleId);
    next.set("schoolId", schoolId);
    next.set("area", activeAreaId);
    setSearchParams(next, { replace: true });
  };

  const setCycle = (nextCycleId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("cycleId", nextCycleId);
    next.set("schoolId", schoolId);
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
    const next = new URLSearchParams(searchParams);
    next.set("cycleId", cycleId);
    next.set("schoolId", schoolId);
    next.set("area", nextAreaId);
    next.delete("indicator");
    setSearchParams(next, { replace: true });
  };

  const hasFeedback = useMemo(
    () => Object.values(reviews).some((review) => review.status === "observado" || review.status === "bloqueado"),
    [reviews]
  );
  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === cycleId) ?? null,
    [cycleId, cycles]
  );
  const cycleLocked = selectedCycle?.isClosed ?? false;
  const canEdit = !cycleLocked && (submission.status === "borrador" || submission.status === "devuelto");

  const visibleIndicators = useMemo(() => {
    if (!activeArea) return [];

    const term = search.trim().toLowerCase();
    // Solo los indicadores visibles del area actual participan en busqueda y progreso.
    let source = activeArea.indicators.filter((indicator) => isIndicatorVisible(indicator, responses));

    if (highlightedIndicatorId) {
      source = source.filter((indicator) => indicator.id === highlightedIndicatorId);
    }

    if (!term) return source;
    return source.filter((indicator) => indicator.name.toLowerCase().includes(term));
  }, [activeArea, highlightedIndicatorId, responses, search]);

  const areaStats = useMemo(() => {
    if (!activeArea) return { total: 0, completos: 0, incompletos: 0, pendientes: 0 };

    const indicators = activeArea.indicators.filter((indicator) => isIndicatorVisible(indicator, responses));

    let completos = 0;
    let incompletos = 0;
    let pendientes = 0;

    for (const indicator of indicators) {
      const response = responses[indicator.id] ?? defaultIndicatorResponse();
      const status = statusFromPct(calcIndicatorPct(indicator, response));

      if (status === "completo") completos++;
      else if (status === "incompleto") incompletos++;
      else pendientes++;
    }

    return { total: indicators.length, completos, incompletos, pendientes };
  }, [activeArea, responses]);

  const globalStats = useMemo(() => {
    const allIndicators = AREAS_SCHEMA.flatMap((area) =>
      area.indicators.filter((indicator) => isIndicatorVisible(indicator, responses))
    );

    let completos = 0;
    let incompletos = 0;
    let pendientes = 0;

    for (const indicator of allIndicators) {
      const response = responses[indicator.id] ?? defaultIndicatorResponse();
      const status = statusFromPct(calcIndicatorPct(indicator, response));

      if (status === "completo") completos++;
      else if (status === "incompleto") incompletos++;
      else pendientes++;
    }

    return { total: allIndicators.length, completos, incompletos, pendientes };
  }, [responses]);

  const onUpdateIndicator = (indicatorId: string, next: IndicatorResponse) => {
    if (!canEdit) return;

    void setResponses((prev) => ({
      ...prev,
      [indicatorId]: next,
    }));
  };

  const onSend = () => {
    if (cycleLocked) return;

    if (globalStats.total === 0) {
      window.alert("No hay indicadores para enviar.");
      return;
    }

    void setSubmission((prev) => ({
      ...prev,
      status: "enviado",
      submittedAt: new Date().toISOString(),
      message: "Formulario enviado para revisión.",
    }));
  };

  const onEnableEditFromFeedback = () => {
    if (cycleLocked) return;

    void setSubmission((prev) => ({
      ...prev,
      status: "devuelto",
      returnedAt: new Date().toISOString(),
      message: "Formulario habilitado nuevamente para ajustes.",
    }));
  };

  const onBackToDraft = () => {
    if (cycleLocked) return;

    void setSubmission((prev) => ({
      ...prev,
      status: "borrador",
      message: "Formulario en edición.",
    }));
  };

  const documentsHref = `/school/documents?cycleId=${encodeURIComponent(cycleId)}&schoolId=${encodeURIComponent(
    schoolId
  )}`;

  return (
    <div className="fni-page-shell">
      <div className="fni-page-kicker">
        <span className="text-slate-900 font-medium">Mi colegio</span>
        <span className="mx-2">/</span>
        <span>Evaluación FNI</span>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="fni-page-title">Evaluación FNI - {schoolLabel}</h1>
          <p className="fni-page-subtitle">
            Responde el formulario por indicador, adjunta PDF y envía el ciclo a revisión.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cycleId}
            onChange={(event) => setCycle(event.target.value)}
            disabled={cyclesLoading}
            className="fni-cycle-select"
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

          {!cycleLocked && (submission.status === "borrador" || submission.status === "devuelto") ? (
            <button type="button" onClick={onSend} className="fni-toolbar-button-primary">
              Enviar formulario
            </button>
          ) : null}

          {!cycleLocked && submission.status === "enviado" && hasFeedback ? (
            <button
              type="button"
              onClick={onEnableEditFromFeedback}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100"
            >
              Editar por feedback
            </button>
          ) : null}

          {!cycleLocked && submission.status === "enviado" ? (
            <button type="button" onClick={onBackToDraft} className="fni-toolbar-button">
              Volver a borrador
            </button>
          ) : null}
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${submissionTone(submission.status)}`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">
              Estado del formulario: {submission.status.toUpperCase()}
            </div>
            <div className="mt-1 text-sm">{submission.message || "Sin mensaje."}</div>
          </div>

          <div className="text-xs opacity-80">
            Enviado: {formatDate(submission.submittedAt)} / Devuelto: {formatDate(submission.returnedAt)} /
            Aprobado: {formatDate(submission.approvedAt)}
          </div>
        </div>
      </div>

      <div className="fni-data-panel p-4 text-sm text-slate-600">
        Fuente activa: <span className="font-medium text-slate-900">{repository.source}</span>
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
          {selectedCycle?.name ?? `Ciclo ${cycleId}`} está cerrado. El formulario queda disponible solo en modo
          lectura.
        </div>
      )}

      {hasFeedback && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Fundación/Admin dejó observaciones o bloqueos en algunos indicadores. Puedes revisarlos abajo y, si
          corresponde, habilitar edición para corregir y reenviar.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
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
                <div className="rounded-lg bg-amber-50 p-2">
                  <div className="text-xs text-amber-700">Incompletos</div>
                  <div className="font-semibold text-amber-900">{areaStats.incompletos}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">Pendientes</div>
                  <div className="font-semibold text-slate-900">{areaStats.pendientes}</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                La pantalla ya guarda usando la capa compartida sobre {repository.source}.
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">Resumen global</div>
              <div className="mt-2 text-sm text-slate-700">
                Total: <b>{globalStats.total}</b>
              </div>
              <div className="text-sm text-slate-700">
                Completos: <b>{globalStats.completos}</b>
              </div>
              <div className="text-sm text-slate-700">
                Incompletos: <b>{globalStats.incompletos}</b>
              </div>
              <div className="text-sm text-slate-700">
                Pendientes: <b>{globalStats.pendientes}</b>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">{activeArea?.name ?? "Área"}</div>
                <p className="mt-1 text-sm text-slate-600">
                  Completa cada indicador, adjunta PDF cuando corresponda y agrega contexto útil.
                </p>
              </div>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar indicador..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 md:max-w-xs"
              />
            </div>
          </div>

          {visibleIndicators.length === 0 ? (
            <div className="fni-empty-state-panel">
              No hay indicadores para mostrar con el filtro actual.
            </div>
          ) : (
            visibleIndicators.map((indicator) => (
              <IndicatorCard
                key={indicator.id}
                indicator={indicator}
                response={responses[indicator.id] ?? defaultIndicatorResponse()}
                review={reviews[indicator.id]}
                disabled={!canEdit}
                highlighted={indicator.id === highlightedIndicatorId}
                schoolRef={{ schoolId, cycleId }}
                schoolCode={schoolCode}
                onUpdate={(next) => onUpdateIndicator(indicator.id, next)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function EvaluationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = getUser();

  const cycleId = searchParams.get("cycleId") ?? "2026";
  const search = searchParams.get("q") ?? "";
  const schoolId = searchParams.get("schoolId") || user?.schoolId || "sch_1";
  const activeAreaId = searchParams.get("area") ?? AREAS_SCHEMA[0]?.id ?? "";
  const highlightedIndicatorId = searchParams.get("indicator") ?? "";

  return (
    <EvaluationWorkspace
      key={`${schoolId}:${cycleId}`}
      schoolId={schoolId}
      cycleId={cycleId}
      search={search}
      activeAreaId={activeAreaId}
      highlightedIndicatorId={highlightedIndicatorId}
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
}
