import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { hasRole, getUser } from "../../../shared/auth";
import { apiGet } from "../../../shared/api";
import { updateCatalogIndicator } from "../../../shared/admin/client";
import type { CatalogAreaDto, CatalogIndicatorDto } from "../../../shared/fni/apiContracts";

// Detalle y edicion de un indicador del catalogo. Admin puede cambiar nombre, orden y estado.
export default function IndicatorDetail() {
  const navigate = useNavigate();
  const { indicatorId } = useParams<{ indicatorId: string }>();
  const user = getUser();
  const isAdmin = hasRole(user, "ADMIN");

  const [areas, setAreas] = useState<CatalogAreaDto[]>([]);
  const [indicator, setIndicator] = useState<CatalogIndicatorDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftOrder, setDraftOrder] = useState(1);
  const [draftStatus, setDraftStatus] = useState<CatalogIndicatorDto["status"]>("active");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    // Cargar areas primero mejora la etiqueta del contexto sin bloquear la vista del indicador.
    apiGet<CatalogAreaDto[]>("/areas").then(setAreas).catch(() => {});
  }, []);

  useEffect(() => {
    if (!indicatorId) return;

    // El detalle del indicador se resuelve por id y alimenta el formulario editable.
    apiGet<CatalogIndicatorDto>(`/indicators/${indicatorId}`)
      .then((nextIndicator) => {
        setIndicator(nextIndicator);
        setError(null);
        setDraftName(nextIndicator.name);
        setDraftOrder(nextIndicator.order);
        setDraftStatus(nextIndicator.status);
        setSaveMessage(null);
      })
      .catch(() => {
        setIndicator(null);
        setError("No se encontro el indicador.");
      });
  }, [indicatorId]);

  const areaLabel = useMemo(() => {
    if (!indicator) return "-";
    const area = areas.find((item) => item.id === indicator.areaId);
    return area ? `${area.code} - ${area.name}` : "-";
  }, [areas, indicator]);

  const hasChanges =
    indicator != null &&
    (draftName.trim() !== indicator.name || draftOrder !== indicator.order || draftStatus !== indicator.status);

  const onSave = async () => {
    if (!indicator || !isAdmin || !hasChanges) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const updated = await updateCatalogIndicator(indicator.id, {
        name: draftName.trim(),
        order: draftOrder,
        status: draftStatus,
      });

      setIndicator(updated);
      setDraftName(updated.name);
      setDraftOrder(updated.order);
      setDraftStatus(updated.status);
      setSaveMessage("Indicador actualizado.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "No se pudo actualizar el indicador.";
      setSaveMessage(message);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="w-full space-y-4">
        <button type="button" onClick={() => navigate(-1)} className="fni-toolbar-button">
          Volver
        </button>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!indicator) {
    return <div className="w-full text-sm text-slate-500">Cargando indicador...</div>;
  }

  const statusLabel = indicator.status === "active" ? "Activo" : "Inactivo";

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="fni-page-kicker">
            Catalogo <span className="mx-2">/</span> Indicadores <span className="mx-2">/</span> {indicator.code}
          </div>
          <h1 className="fni-page-title">{indicator.code}</h1>
          <p className="fni-page-subtitle">{indicator.name}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="fni-toolbar-button">
            Volver
          </button>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!hasChanges || saving}
              className="fni-toolbar-button-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          ) : (
            <span
              className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              title="Solo lectura para Fundacion"
            >
              Solo lectura
            </span>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">Nombre</span>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-slate-200"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">Orden</span>
              <input
                type="number"
                min={1}
                value={draftOrder}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  const parsed = raw ? Number(raw) : 1;
                  setDraftOrder(Number.isFinite(parsed) && parsed >= 1 ? parsed : 1);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-slate-200"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">Estado</span>
              <select
                value={draftStatus}
                onChange={(event) => setDraftStatus(event.target.value as CatalogIndicatorDto["status"])}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-slate-200"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Los cambios quedan disponibles solo para administracion. La evaluacion del colegio se mantiene por
            ahora con el schema de preguntas actual.
          </div>

          {saveMessage && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {saveMessage}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="fni-metric-card border-slate-200 bg-white">
          <div className="text-xs font-semibold tracking-wide text-slate-500">AREA</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{areaLabel}</div>
        </div>

        <div className="fni-metric-card border-slate-200 bg-white">
          <div className="text-xs font-semibold tracking-wide text-slate-500">ESTADO</div>
          <div className="mt-2">
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                indicator.status === "active"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-100 text-slate-700"
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="fni-metric-card border-slate-200 bg-white">
          <div className="text-xs font-semibold tracking-wide text-slate-500">ORDEN</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{indicator.order}</div>
        </div>

        <div className="fni-metric-card border-slate-200 bg-white">
          <div className="text-xs font-semibold tracking-wide text-slate-500">ID</div>
          <div className="mt-2 break-all font-mono text-sm text-slate-700">{indicator.id}</div>
        </div>
      </div>
    </div>
  );
}
