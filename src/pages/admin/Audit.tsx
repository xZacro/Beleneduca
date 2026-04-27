import { useEffect, useMemo, useState } from "react";

import type { AdminAuditEventDto, AuditEventType } from "../../shared/admin/apiContracts";
import { listAuditEvents } from "../../shared/admin/client";
import { useSchoolDirectory } from "../../shared/useSchoolDirectory";

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
  if (type === "LOGIN") return "Ingreso";
  if (type === "LOGOUT") return "Salida";
  if (type === "HEARTBEAT") return "Actividad";
  if (type === "ROLE_SWITCH") return "Cambio de rol";
  return "Cambio";
}

function getMetaAction(event: AdminAuditEventDto) {
  const action = event.meta?.action;
  return typeof action === "string" ? action : null;
}

function friendlyActionLabelLegacy(action: string): string {
  if (action === "RESPONSES_SAVED") return "Respuestas guardadas";
  if (action === "REVIEWS_SAVED") return "Revisión guardada";
  if (action === "SUBMISSION_SAVED") return "Envío guardado";
  if (action === "DOCUMENT_UPLOADED") return "Documento subido";
  if (action === "PASSWORD_CHANGED") return "Contraseña actualizada";
  if (action === "PASSWORD_RECOVERY_REQUESTED") return "Solicitud de recuperación";

  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function eventTone(event: AdminAuditEventDto) {
  const action = getMetaAction(event);

  if (action === "PASSWORD_RECOVERY_REQUESTED") return "border-amber-200 bg-amber-50 text-amber-800";
  if (event.type === "LOGIN") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (event.type === "LOGOUT") return "border-slate-200 bg-slate-50 text-slate-700";
  if (event.type === "CHANGE") return "border-blue-200 bg-blue-50 text-blue-800";
  if (event.type === "ROLE_SWITCH") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function friendlyActionLabel(action: string): string {
  return friendlyActionLabelLegacy(action);
}

function formatMeta(
  meta: Record<string, unknown> | null,
  schoolNameById: Map<string, string>
) {
  if (!meta) return "Sin detalle.";

  // Solo mostramos las claves mas utiles para lectura humana y debugging rapido.
  const priorityKeys = [
    "action",
    "cycleName",
    "cycleId",
    "schoolId",
    "requesterEmail",
    "indicatorId",
    "documentId",
    "fileName",
    "indicatorCount",
    "submissionStatus",
    "message",
    "targetEmail",
    "targetUserId",
    "status",
  ];

  const formatted: string[] = [];

  for (const key of priorityKeys) {
    if (!(key in meta)) continue;
    const value = meta[key];
    if (Array.isArray(value)) {
      formatted.push(`${key}: ${value.join(", ")}`);
    } else if (value != null && value !== "") {
      let label = String(value);
      let friendlyKey = key;

      if (key === "action") {
        friendlyKey = "AcciÃ³n";
        label = friendlyActionLabel(label);
      } else if (key === "cycleName" || key === "cycleId") {
        friendlyKey = "Ciclo";
        label = key === "cycleName" ? String(value) : `Ciclo ${value}`;
      } else if (key === "schoolId") {
        friendlyKey = "Colegio";
        label = schoolNameById.get(String(value)) ?? String(value);
      } else if (key === "indicatorCount") {
        friendlyKey = "Indicadores";
      } else if (key === "submissionStatus") {
        friendlyKey = "Estado del envÃ­o";
      } else if (key === "targetEmail") {
        friendlyKey = "Correo destino";
      } else if (key === "requesterEmail") {
        friendlyKey = "Correo solicitante";
      } else if (key === "targetUserId") {
        friendlyKey = "Usuario destino";
      } else if (key === "indicatorId") {
        friendlyKey = "Indicador";
      } else if (key === "documentId") {
        friendlyKey = "Documento";
      } else if (key === "fileName") {
        friendlyKey = "Archivo";
      } else if (key === "status") {
        friendlyKey = "Estado";
      }

      formatted.push(`${friendlyKey}: ${label}`);
    }
  }

  if (!formatted.length) {
    return "Sin detalle estructurado.";
  }

  return formatted.join(" | ");
}

export default function AdminAudit() {
  const { schools } = useSchoolDirectory();
  const [events, setEvents] = useState<AdminAuditEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | AuditEventType>("ALL");
  const schoolNameById = useMemo(
    () => new Map(schools.map((school) => [school.id, `${school.code} - ${school.name}`])),
    [schools]
  );

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      // La auditoria es una foto del backend; siempre se consulta fresca.
      const rows = await listAuditEvents();
      setEvents(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la actividad.");
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
        `${event.actorName} ${event.actorEmail} ${event.actorRoles.join(" ")} ${formatMeta(
          event.meta,
          schoolNameById
        )}`.toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesType = typeFilter === "ALL" || event.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [events, schoolNameById, search, typeFilter]);

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

  const recoveryRequests = useMemo(() => {
    return events
      .filter((event) => getMetaAction(event) === "PASSWORD_RECOVERY_REQUESTED")
      .sort((left, right) => {
        const leftDate = left.at ? new Date(left.at).getTime() : 0;
        const rightDate = right.at ? new Date(right.at).getTime() : 0;
        return rightDate - leftDate;
      });
  }, [events]);

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="fni-page-title">Actividad</h1>
          <p className="fni-page-subtitle">
            Ingresos, salidas, cambios importantes y solicitudes de acceso registradas por el sistema.
          </p>
        </div>

        <button type="button" onClick={() => void load()} className="fni-toolbar-button">
          Refrescar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="fni-metric-card border-slate-200 bg-slate-50">
          <div className="text-xs font-semibold tracking-wide text-slate-500">Actividad hoy</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{metrics.today}</div>
        </div>
        <div className="fni-metric-card border-emerald-200 bg-emerald-50">
          <div className="text-xs font-semibold tracking-wide text-emerald-700">Ingresos</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-900">{metrics.logins}</div>
        </div>
        <div className="fni-metric-card border-blue-200 bg-blue-50">
          <div className="text-xs font-semibold tracking-wide text-blue-700">Cambios</div>
          <div className="mt-2 text-3xl font-semibold text-blue-900">{metrics.changes}</div>
        </div>
        <div className="fni-metric-card border-slate-200 bg-white">
          <div className="text-xs font-semibold tracking-wide text-slate-500">Salidas</div>
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
              placeholder="Usuario, email, rol o detalle"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="md:col-span-4">
            <label className="fni-field-label">Evento</label>
            <select
              value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as "ALL" | AuditEventType)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
              >
                <option value="ALL">Todos</option>
              <option value="LOGIN">Ingreso</option>
              <option value="LOGOUT">Salida</option>
              <option value="CHANGE">Cambio</option>
              <option value="ROLE_SWITCH">Cambio de rol</option>
              <option value="HEARTBEAT">Actividad</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Solicitudes de acceso</h2>
            <p className="mt-1 text-sm text-slate-600">
              Recuperaciones pedidas desde el inicio de sesiÃ³n para revisiÃ³n manual.
            </p>
          </div>

          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
              recoveryRequests.length > 0
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {recoveryRequests.length > 0
              ? `${recoveryRequests.length} pendientes`
              : "Sin solicitudes pendientes"}
          </span>
        </div>

        {recoveryRequests.length === 0 ? (
          <div className="fni-empty-state-panel mt-4 min-h-[140px]">
            No hay solicitudes de acceso registradas por ahora.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <table className="fni-data-table">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Correo</th>
                  <th className="px-4 py-3 text-left font-semibold">Detalle</th>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recoveryRequests.slice(0, 12).map((event) => {
                  const message =
                    typeof event.meta?.message === "string" && event.meta.message.trim()
                      ? event.meta.message.trim()
                      : "Sin detalle adicional.";
                  const status =
                    typeof event.meta?.status === "string" && event.meta.status.trim()
                      ? event.meta.status.trim()
                      : "PENDING";
                  const statusLabel = status === "PENDING" ? "Pendiente" : status;
                  const statusTone =
                    status === "PENDING"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-slate-50 text-slate-700";

                  return (
                    <tr key={event.id} className="align-top hover:bg-slate-50/60">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{event.actorEmail}</div>
                        <div className="text-sm text-slate-600">{event.actorName}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{message}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(event.at)}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
                <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                <th className="px-4 py-3 text-left font-semibold">Evento</th>
                <th className="px-4 py-3 text-left font-semibold">Roles</th>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600">
                    Cargando actividad...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600">
                    No hay eventos para los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const action = getMetaAction(event);
                  const badgeLabel = action ? friendlyActionLabel(action) : eventLabel(event.type);
                  const badgeTone =
                    action === "PASSWORD_RECOVERY_REQUESTED"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : eventTone(event);

                  return (
                    <tr key={event.id} className="align-top hover:bg-slate-50/60">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{event.actorName}</div>
                        <div className="text-sm text-slate-600">{event.actorEmail}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone}`}
                        >
                          {badgeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {event.actorRoles.length ? event.actorRoles.join(", ") : "-"}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(event.at)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatMeta(event.meta, schoolNameById)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

