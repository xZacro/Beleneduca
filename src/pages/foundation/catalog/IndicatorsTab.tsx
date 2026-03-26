import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiGet } from "../../../shared/api";
import type { CatalogAreaDto, CatalogIndicatorDto } from "../../../shared/fni/apiContracts";

// Lista navegable de indicadores con filtros por area, estado y texto.
function statusLabel(status: CatalogIndicatorDto["status"]) {
  return status === "active" ? "Activo" : "Inactivo";
}

export default function IndicatorsTab() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState<CatalogAreaDto[]>([]);
  const [rows, setRows] = useState<CatalogIndicatorDto[]>([]);
  const [areaId, setAreaId] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    // El mapa de areas se usa solo para mostrar etiquetas legibles en la tabla.
    apiGet<CatalogAreaDto[]>("/areas").then(setAreas);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (areaId) params.set("areaId", areaId);
    if (q.trim()) params.set("q", q.trim());
    if (status !== "all") params.set("status", status);

    // Reutilizamos el endpoint de indicadores para mantener la misma fuente de verdad que la tabla.
    apiGet<CatalogIndicatorDto[]>(`/indicators?${params.toString()}`).then(setRows);
  }, [areaId, q, status]);

  const areaNameById = useMemo(() => {
    const map = new Map<string, string>();
    areas.forEach((area) => map.set(area.id, `${area.code} - ${area.name}`));
    return map;
  }, [areas]);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={areaId}
          onChange={(event) => setAreaId(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-4 focus:ring-slate-200"
        >
          <option value="">Todas las áreas</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.code} - {area.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "all" | "active" | "inactive")}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-4 focus:ring-slate-200"
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>

        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Buscar por texto o código..."
          className="w-full max-w-lg rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-slate-200"
        />
      </div>

      <div className="fni-data-table-shell">
        <div className="fni-data-table-scroll">
          <table className="fni-data-table">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Código</th>
                <th className="px-4 py-3 text-left font-semibold">Indicador</th>
                <th className="px-4 py-3 text-left font-semibold">Área</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((indicator) => (
                <tr
                  key={indicator.id}
                  onClick={() => navigate(`/foundation/catalog/indicators/${indicator.id}`)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">{indicator.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{indicator.name}</td>
                  <td className="px-4 py-3 text-slate-700">{areaNameById.get(indicator.areaId) ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                        indicator.status === "active"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {statusLabel(indicator.status)}
                    </span>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
