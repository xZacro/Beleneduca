import { useEffect, useState } from "react";
import AreasTab from "../catalog/AreasTab";
import IndicatorsTab from "../catalog/IndicatorsTab";
import { apiGet, apiPost } from "../../../shared/api";
import { getUser, hasRole } from "../../../shared/auth";
import type { CatalogAreaDto, CatalogIndicatorDto, CatalogSeedResponse } from "../../../shared/fni/apiContracts";

// Contenedor del catalogo FNI: alterna entre areas e indicadores y permite seed en admin.
export default function CatalogPage() {
  const [tab, setTab] = useState<"areas" | "indicators">("areas");
  const [areasCount, setAreasCount] = useState(0);
  const [indicatorsCount, setIndicatorsCount] = useState(0);
  const user = getUser();
  const isAdmin = hasRole(user, "ADMIN");
  const isFoundation = hasRole(user, "FUNDACION");

  useEffect(() => {
    apiGet<CatalogAreaDto[]>("/areas").then((rows) => setAreasCount(rows.length));
    apiGet<CatalogIndicatorDto[]>("/indicators").then((rows) => setIndicatorsCount(rows.length));
  }, []);

  const onSeed = async () => {
    // Seed solo para admin, porque reinicia el catalogo base del entorno local.
    await apiPost<CatalogSeedResponse>("/catalog/seed");
    window.location.reload();
  };

  const contextLabel = isAdmin ? "Administración" : isFoundation ? "Fundación" : "Catálogo";
  const contextSubtitle = isAdmin
    ? "Gestión del catálogo documental para administración."
    : "Áreas e indicadores disponibles en el catálogo.";

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
              Recargar catálogo
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-600">Sección activa</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {tab === "areas" ? `${areasCount} áreas` : `${indicatorsCount} indicadores`}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {tab === "areas"
              ? "Registros disponibles en el catálogo."
              : "Indicadores listos para revisión y seguimiento."}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-600">Acceso actual</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{contextLabel}</div>
          <div className="mt-1 text-sm text-slate-600">
            {user?.email ? `Sesión activa: ${user.email}` : "Sesión activa en el catálogo."}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-600">Estado del catálogo</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Listo</div>
          <div className="mt-1 text-sm text-slate-600">
            {isAdmin
              ? "Administración puede recargar el catálogo cuando necesite restablecer la información."
              : "Datos listos para consulta."}
          </div>
        </div>
      </div>

      <div className="fni-data-panel">
        {tab === "areas" ? <AreasTab /> : <IndicatorsTab />}
      </div>
    </div>
  );
}
