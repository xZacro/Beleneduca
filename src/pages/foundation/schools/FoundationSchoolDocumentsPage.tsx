import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ROUTES } from "../../../app/routes/routeConfig";
import { getUploadedPdfHref, openUploadedPdf } from "../../../shared/fni/documentClient";
import { AREAS_SCHEMA } from "../../../shared/fni/schema/evaluacionSchema";
import { useFniWorkspace } from "../../../shared/fni/useFniWorkspace";
import { useResolvedSchoolCycleRef } from "../../../shared/fni/useResolvedSchoolCycleRef";
import type { IndicatorResponse, IndicatorReview, SubmissionRecord } from "../../../shared/fni/types";
import { useFoundationSchoolDisplayName } from "../../../shared/useSchoolDirectory";

type AreaLike = {
  id: string;
  title?: string;
  name?: string;
  label?: string;
  indicators?: IndicatorLike[];
};

type IndicatorLike = {
  id: string;
  title?: string;
  name?: string;
  label?: string;
};

type DocumentRow = {
  areaId: string;
  areaLabel: string;
  indicatorId: string;
  indicatorLabel: string;
  response: IndicatorResponse | null;
  review: IndicatorReview | null;
  documentStatus: string;
  updatedAt: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("es-CL");
}

function getAreaLabel(area: AreaLike) {
  return area.title || area.name || area.label || area.id;
}

function getIndicatorLabel(indicator: IndicatorLike) {
  return indicator.title || indicator.name || indicator.label || indicator.id;
}

function getReviewLabel(review: IndicatorReview | null) {
  if (!review) return "Sin revisión";

  switch (review.status) {
    case "aprobado":
      return "Aprobado";
    case "observado":
      return "Observado";
    case "bloqueado":
      return "Bloqueado";
    default:
      return "Pendiente";
  }
}

function getDocumentStatus(
  response: IndicatorResponse | null,
  review: IndicatorReview | null,
  submission: SubmissionRecord
) {
  const hasEvidence = !!response?.file || !!response?.documentRef.trim() || !!response?.comments.trim();

  if (!hasEvidence) return "Sin evidencia";
  if (review?.status === "aprobado") return "Validado";
  if (review?.status === "observado") return "Con observación";
  if (review?.status === "bloqueado") return "Bloqueado";
  if (submission.status === "enviado") return "Pendiente de revisión";
  if (submission.status === "devuelto") return "Devuelto";
  if (submission.status === "aprobado") return "Formulario aprobado";
  return "Cargado";
}

export default function FoundationSchoolDocumentsPage() {
  const { schoolId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState("all");

  const cycleIdParam = searchParams.get("cycleId");
  const selectedIndicatorId = searchParams.get("indicatorId") ?? "";
  const { ref, loading: resolvingRef, error: contextError } = useResolvedSchoolCycleRef({
    schoolId,
    cycleId: cycleIdParam,
  });
  const { workspace, loading, error } = useFniWorkspace(ref);
  const cycleId = ref?.cycleId ?? null;
  const { schoolLabel } = useFoundationSchoolDisplayName(schoolId, cycleId);
  const resolvedSchoolLabel = searchParams.get("schoolLabel")?.trim() || schoolLabel;

  const rows = useMemo<DocumentRow[]>(() => {
    if (!workspace) return [];

    const nextRows: DocumentRow[] = [];

    for (const area of AREAS_SCHEMA as AreaLike[]) {
      for (const indicator of area.indicators || []) {
        const response = (workspace.responses[indicator.id] ?? null) as IndicatorResponse | null;
        const review = (workspace.reviews[indicator.id] ?? null) as IndicatorReview | null;
        if (!response) continue;

        const hasEvidence = !!response.file || !!response.documentRef.trim() || !!response.comments.trim();
        if (!hasEvidence) continue;

        nextRows.push({
          areaId: area.id,
          areaLabel: getAreaLabel(area),
          indicatorId: indicator.id,
          indicatorLabel: getIndicatorLabel(indicator),
          response,
          review,
          documentStatus: getDocumentStatus(response, review, workspace.submission),
          updatedAt: response.updatedAt || response.file?.uploadedAt || null,
        });
      }
    }

    return nextRows;
  }, [workspace]);

  const documentSummary = useMemo(() => {
    const total = rows.length;
    const pdfs = rows.filter((row) => Boolean(row.response?.file)).length;
    const reviewed = rows.filter((row) => row.review && row.review.status !== "pendiente").length;

    return { total, pdfs, reviewed };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesArea = selectedArea === "all" || row.areaId === selectedArea;
      const matchesIndicator = !selectedIndicatorId || row.indicatorId === selectedIndicatorId;
      const matchesSearch =
        !term ||
        row.areaLabel.toLowerCase().includes(term) ||
        row.indicatorLabel.toLowerCase().includes(term) ||
        row.response?.file?.name.toLowerCase().includes(term) ||
        row.response?.documentRef.toLowerCase().includes(term) ||
        row.response?.comments.toLowerCase().includes(term) ||
        row.review?.reviewComment.toLowerCase().includes(term);

      return matchesArea && matchesIndicator && matchesSearch;
    });
  }, [rows, search, selectedArea, selectedIndicatorId]);

  if (!schoolId) {
    return (
      <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No se recibió <span className="font-medium">schoolId</span> en la ruta.
      </div>
    );
  }

  if (resolvingRef || (loading && !workspace)) {
    return (
      <div className="w-full space-y-4">
        <div className="fni-data-panel">
          <h1 className="fni-page-title">Documentos del colegio</h1>
          <p className="mt-2 text-sm text-slate-600">Cargando evidencias del colegio...</p>
        </div>
      </div>
    );
  }

  if (!cycleId || !workspace) {
    return (
      <div className="w-full space-y-4">
        <div className="fni-data-panel">
          <h1 className="fni-page-title">Documentos del colegio</h1>
          <p className="mt-2 text-sm text-slate-600">
            No se pudo resolver el <span className="font-medium">cycleId</span>.
          </p>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Abre la ruta con query param:
            <br />
            <code className="mt-2 inline-block rounded bg-white px-2 py-1">
              /foundation/schools/{schoolId}/documents?cycleId=2025
            </code>
          </div>

          {(contextError || error) && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {contextError || error}
            </div>
          )}
        </div>
      </div>
    );
  }
  const schoolFormPath = `${ROUTES.foundation.schoolForm.replace(
    ":schoolId",
    schoolId
  )}?cycleId=${encodeURIComponent(cycleId)}`;
  const schoolReviewPath = `${ROUTES.foundation.schoolReview.replace(
    ":schoolId",
    schoolId
  )}?cycleId=${encodeURIComponent(cycleId)}`;

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="fni-page-title">Documentos del colegio</h1>
          <p className="fni-page-subtitle">
            Evidencias ligadas a indicadores del colegio, con foco en revisión y seguimiento.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={schoolFormPath} className="fni-toolbar-button inline-flex items-center">
            Ver formulario
          </Link>

          <Link to={schoolReviewPath} className="fni-toolbar-button-primary inline-flex items-center">
            Ir a revisión
          </Link>
        </div>
      </div>

      <div className="fni-data-panel p-4 text-sm text-slate-600">
        {documentSummary.total} evidencias visibles · {documentSummary.pdfs} con PDF ·{" "}
        {documentSummary.reviewed} con revisión
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
      )}

      <div className="fni-data-panel grid gap-3 p-4 md:grid-cols-3">
        <label className="space-y-1">
          <span className="fni-field-label">Buscar</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Indicador, archivo, referencia o comentario"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="fni-field-label">Área</span>
          <select
            value={selectedArea}
            onChange={(event) => setSelectedArea(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="all">Todas</option>
            {(AREAS_SCHEMA as AreaLike[]).map((area) => (
              <option key={area.id} value={area.id}>
                {getAreaLabel(area)}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <div>
            <span className="font-medium">Colegio:</span> {resolvedSchoolLabel}
          </div>
          <div>
            <span className="font-medium">Ciclo:</span> {cycleId}
          </div>
          <div>
            <span className="font-medium">Estado de envío:</span> {workspace.submission.status}
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="fni-empty-state-panel">
          Este colegio no tiene evidencias cargadas que coincidan con los filtros.
        </div>
      ) : (
        <div className="fni-data-table-shell">
          <div className="fni-data-table-scroll">
            <table className="fni-data-table">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Área</th>
                  <th className="px-4 py-3 text-left font-semibold">Indicador</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado documental</th>
                  <th className="px-4 py-3 text-left font-semibold">Archivo / referencia</th>
                  <th className="px-4 py-3 text-left font-semibold">Revisión</th>
                  <th className="px-4 py-3 text-left font-semibold">Actualización</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRows.map((row) => (
                  <tr key={row.indicatorId} className="align-top hover:bg-slate-50/60">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{row.areaLabel}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{row.indicatorLabel}</div>
                      {row.response?.comments.trim() && (
                        <div className="mt-1 max-w-md text-xs text-slate-500 whitespace-pre-wrap">
                          {row.response.comments.trim()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {row.documentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-slate-800">{row.response?.file?.name || "Sin archivo PDF"}</div>
                      <div className="mt-1 max-w-sm text-xs text-slate-500 whitespace-pre-wrap">
                        {row.response?.documentRef.trim() || "Sin referencia documental"}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-slate-800">{getReviewLabel(row.review)}</div>
                      <div className="mt-1 max-w-sm text-xs text-slate-500 whitespace-pre-wrap">
                        {row.review?.reviewComment.trim() || "Sin comentario de revisión"}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{formatDate(row.updatedAt)}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {getUploadedPdfHref(row.response?.file) && (
                          <button
                            type="button"
                            onClick={() => openUploadedPdf(row.response?.file)}
                            className="fni-toolbar-button-primary whitespace-nowrap px-3 py-2 text-xs"
                          >
                            Ver PDF
                          </button>
                        )}

                        <Link
                          to={`${schoolReviewPath}&indicator=${encodeURIComponent(row.indicatorId)}`}
                          className="fni-toolbar-button whitespace-nowrap px-3 py-2 text-xs"
                        >
                          Revisar indicador
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
