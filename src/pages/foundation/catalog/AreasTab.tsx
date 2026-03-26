import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../shared/api";
import type { CatalogAreaDto } from "../../../shared/fni/apiContracts";

// Tabla simple de areas: consulta el catalogo compartido y filtra por texto.
export default function AreasTab() {
  const [areas, setAreas] = useState<CatalogAreaDto[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    // La lista de areas viene del backend y cambia poco, pero se carga al montar.
    apiGet<CatalogAreaDto[]>("/areas").then(setAreas);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return areas;
    return areas.filter((area) => area.name.toLowerCase().includes(term) || area.code.toLowerCase().includes(term));
  }, [areas, q]);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Buscar por nombre o código..."
          className="w-full max-w-lg rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-slate-200"
        />

        <button
          type="button"
          onClick={() => apiGet<CatalogAreaDto[]>("/areas").then(setAreas)}
          className="fni-toolbar-button"
        >
          Refrescar
        </button>
      </div>

      <div className="fni-data-table-shell">
        <div className="fni-data-table-scroll">
          <table className="fni-data-table">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Código</th>
              <th className="px-4 py-3 text-left font-semibold">Área</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((area) => (
              <tr key={area.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-semibold text-slate-900">{area.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{area.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                      area.status === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {area.status === "active" ? "Activa" : "Inactiva"}
                  </span>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
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
