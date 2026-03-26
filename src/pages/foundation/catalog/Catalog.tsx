import { useState } from "react";
import AreasTab from "../catalog/AreasTab";
import IndicatorsTab from "../catalog/IndicatorsTab";
import { apiPost } from "../../../shared/api";
import { getUser, hasRole } from "../../../shared/auth";
import type { CatalogSeedResponse } from "../../../shared/fni/apiContracts";

// Contenedor del catalogo FNI: alterna entre areas e indicadores y permite seed en admin.
export default function CatalogPage() {
  const [tab, setTab] = useState<"areas" | "indicators">("areas");
  const user = getUser();
  const isAdmin = hasRole(user, "ADMIN");
  const isFoundation = hasRole(user, "FUNDACION");

  const onSeed = async () => {
    // Seed solo para admin, porque reinicia el catalogo base del entorno local.
    await apiPost<CatalogSeedResponse>("/catalog/seed");
    window.location.reload();
  };

  const contextLabel = isAdmin ? "Administración" : isFoundation ? "Fundación" : "Catálogo";
  const contextSubtitle = isAdmin
    ? "Gestión operativa del catálogo documental para administración."
    : "Áreas e indicadores del módulo documental.";

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="fni-page-kicker">
            Dashboard <span className="mx-2">/</span> {contextLabel} <span className="mx-2">/</span> Catálogo FNI
          </div>
          <h1 className="fni-page-title">Catálogo FNI</h1>
          <p className="fni-page-subtitle">{contextSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("areas")}
            className={tab === "areas" ? "fni-toolbar-button-primary" : "fni-toolbar-button"}
          >
            Áreas
          </button>

          <button
            type="button"
            onClick={() => setTab("indicators")}
            className={tab === "indicators" ? "fni-toolbar-button-primary" : "fni-toolbar-button"}
          >
            Indicadores
          </button>

          {isAdmin && (
            <button type="button" onClick={onSeed} className="fni-toolbar-button">
              Cargar seed
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-600">Vista activa</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {tab === "areas" ? "Áreas" : "Indicadores"}
          </div>
          <div className="mt-1 text-sm text-slate-600">Panel centralizado del catálogo documental.</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-600">Rol</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{contextLabel}</div>
          <div className="mt-1 text-sm text-slate-600">
            Misma estructura visual que los dashboards principales.
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-600">Estado del módulo</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Activo</div>
          <div className="mt-1 text-sm text-slate-600">
            {isAdmin
              ? "Incluye carga de seed para inicializar catálogo y referencias del entorno local."
              : "Catálogo listo para consulta y gestión."}
          </div>
        </div>
      </div>

      <div className="fni-data-panel">
        {tab === "areas" ? <AreasTab /> : <IndicatorsTab />}
      </div>
    </div>
  );
}
