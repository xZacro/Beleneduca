import { useEffect, useMemo, useState } from "react";

import type { AdminAuditEventDto, AuditEventType } from "../../shared/admin/apiContracts";
import { listAuditEvents } from "../../shared/admin/client";

// Trazabilidad operativa: eventos relevantes para entender acciones sensibles.
function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function eventLabel(type: AuditEventType) {
  if (type === "LOGIN") return "Login";
  if (type === "LOGOUT") return "Logout";
  if (type === "HEARTBEAT") return "Heartbeat";
  if (type === "ROLE_SWITCH") return "Cambio de rol";
  return "Cambio";
}

function eventTone(type: AuditEventType) {
  if (type === "LOGIN") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (type === "LOGOUT") return "border-slate-200 bg-slate-50 text-slate-700";
  if (type === "CHANGE") return "border-blue-200 bg-blue-50 text-blue-800";
  if (type === "ROLE_SWITCH") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatMeta(meta: Record<string, unknown> | null) {
  if (!meta) return "Sin detalle.";

  // Solo mostramos las claves mas utiles para lectura humana y debugging rapido.
  const priorityKeys = [
    "action",
    "cycleName",
    "cycleId",
    "schoolId",
    "indicatorId",
    "documentId",
    "fileName",
    "indicatorCount",
    "submissionStatus",
    "targetEmail",
    "targetUserId",
    "status",
    "source",
    "storage",
  ];

  const formatted: string[] = [];

  for (const key of priorityKeys) {
    if (!(key in meta)) continue;
    const value = meta[key];
    if (Array.isArray(value)) {
      formatted.push(`${key}: ${value.join(", ")}`);
    } else if (value != null && value !== "") {
      formatted.push(`${key}: ${String(value)}`);
    }
  }

  if (!formatted.length) {
    return "Sin detalle estructurado.";
  }

  return formatted.join(" | ");
}

export default function AdminAudit() {
  const [events, setEvents] = useState<AdminAuditEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | AuditEventType>("ALL");

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      // La auditoria es una foto del backend; siempre se consulta fresca.
      const rows = await listAuditEvents();
      setEvents(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la auditoría.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return events.filter((event) => {
      // Unificamos actor + meta para que la busqueda sea util desde una sola caja.
      const haystack =
        `${event.actorName} ${event.actorEmail} ${event.actorRoles.join(" ")} ${formatMeta(event.meta)}`.toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesType = typeFilter === "ALL" || event.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [events, search, typeFilter]);

  const metrics = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTimestamp = startOfToday.getTime();

    const today = events.filter((event) => {
      if (!event.at) return false;
      const timestamp = new Date(event.at).getTime();
      return !Number.isNaN(timestamp) && timestamp >= todayTimestamp;
    }).length;

    const logins = events.filter((event) => event.type === "LOGIN").length;
    const changes = events.filter((event) => event.type === "CHANGE").length;
    const logouts = events.filter((event) => event.type === "LOGOUT").length;

    return { today, logins, changes, logouts };
  }, [events]);

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="fni-page-title">Auditoría</h1>
          <p className="fni-page-subtitle">
            Eventos de login, logout y cambios operativos registrados en la API.
          </p>
        </div>

        <button type="button" onClick={() => void load()} className="fni-toolbar-button">
          Refrescar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="fni-metric-card border-slate-200 bg-slate-50">
          <div className="text-xs font-semibold tracking-wide text-slate-500">Eventos hoy</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{metrics.today}</div>
        </div>
        <div className="fni-metric-card border-emerald-200 bg-emerald-50">
          <div className="text-xs font-semibold tracking-wide text-emerald-700">Logins</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-900">{metrics.logins}</div>
        </div>
        <div className="fni-metric-card border-blue-200 bg-blue-50">
          <div className="text-xs font-semibold tracking-wide text-blue-700">Cambios</div>
          <div className="mt-2 text-3xl font-semibold text-blue-900">{metrics.changes}</div>
        </div>
        <div className="fni-metric-card border-slate-200 bg-white">
          <div className="text-xs font-semibold tracking-wide text-slate-500">Logouts</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{metrics.logouts}</div>
        </div>
      </div>

      <div className="fni-data-panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <label className="fni-field-label">Buscar</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Actor, email, rol o detalle"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="md:col-span-4">
            <label className="fni-field-label">Tipo</label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as "ALL" | AuditEventType)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
            >
              <option value="ALL">Todos</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="CHANGE">Cambio</option>
              <option value="ROLE_SWITCH">Cambio de rol</option>
              <option value="HEARTBEAT">Heartbeat</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="fni-data-table-shell">
        <div className="fni-data-table-scroll">
          <table className="fni-data-table">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Actor</th>
                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Roles</th>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600">
                    Cargando auditoría...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600">
                    No hay eventos para los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="align-top hover:bg-slate-50/60">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{event.actorName}</div>
                      <div className="text-sm text-slate-600">{event.actorEmail}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${eventTone(
                          event.type
                        )}`}
                      >
                        {eventLabel(event.type)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {event.actorRoles.length ? event.actorRoles.join(", ") : "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatDate(event.at)}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatMeta(event.meta)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
