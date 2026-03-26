import { useEffect, useMemo, useState } from "react";

import type { AdminSessionDto, AdminSessionStatus } from "../../shared/admin/apiContracts";
import { listSessions } from "../../shared/admin/client";

// Monitor de sesiones: vista de observabilidad para accesos, agentes y actividad reciente.
function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatRelative(value: string | null) {
  if (!value) return "-";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));

  if (diffMinutes < 1) return "Recién";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

function statusLabel(status: AdminSessionStatus) {
  if (status === "ONLINE") return "Online";
  if (status === "IDLE") return "Idle";
  if (status === "REVOKED") return "Revocada";
  return "Offline";
}

function statusTone(status: AdminSessionStatus) {
  if (status === "ONLINE") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "IDLE") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "REVOKED") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "Admin";
  if (role === "FUNDACION") return "Fundación";
  return "Colegio";
}

export default function AdminSessions() {
  const [sessions, setSessions] = useState<AdminSessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AdminSessionStatus>("ALL");

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      // Las sesiones cambian a menudo, por eso siempre recargamos desde la API.
      const rows = await listSessions();
      setSessions(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las sesiones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleSessions = useMemo(() => {
    const term = search.trim().toLowerCase();

    return [...sessions]
      .filter((session) => {
        // Busqueda por metadatos de acceso, no solo por nombre.
        const haystack =
          `${session.userName} ${session.userEmail} ${session.userAgent ?? ""} ${session.ipAddress ?? ""}`.toLowerCase();
        const matchesSearch = !term || haystack.includes(term);
        const matchesStatus = statusFilter === "ALL" || session.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((left, right) => {
        const leftDate = left.lastSeenAt ? new Date(left.lastSeenAt).getTime() : 0;
        const rightDate = right.lastSeenAt ? new Date(right.lastSeenAt).getTime() : 0;
        return rightDate - leftDate;
      });
  }, [search, sessions, statusFilter]);

  const metrics = useMemo(() => {
    const total = sessions.length;
    const online = sessions.filter((session) => session.status === "ONLINE").length;
    const idle = sessions.filter((session) => session.status === "IDLE").length;
    const revoked = sessions.filter((session) => session.status === "REVOKED").length;

    return { total, online, idle, revoked };
  }, [sessions]);

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="fni-page-title">Sesiones</h1>
          <p className="fni-page-subtitle">
            Estado actual de sesiones, últimos accesos y revocaciones desde Prisma.
          </p>
        </div>

        <button type="button" onClick={() => void load()} className="fni-toolbar-button">
          Refrescar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="fni-metric-card border-slate-200 bg-slate-50">
          <div className="text-xs font-semibold tracking-wide text-slate-500">Total</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{metrics.total}</div>
        </div>
        <div className="fni-metric-card border-emerald-200 bg-emerald-50">
          <div className="text-xs font-semibold tracking-wide text-emerald-700">Online</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-900">{metrics.online}</div>
        </div>
        <div className="fni-metric-card border-amber-200 bg-amber-50">
          <div className="text-xs font-semibold tracking-wide text-amber-700">Idle</div>
          <div className="mt-2 text-3xl font-semibold text-amber-900">{metrics.idle}</div>
        </div>
        <div className="fni-metric-card border-rose-200 bg-rose-50">
          <div className="text-xs font-semibold tracking-wide text-rose-700">Revocadas</div>
          <div className="mt-2 text-3xl font-semibold text-rose-900">{metrics.revoked}</div>
        </div>
      </div>

      <div className="fni-data-panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <label className="fni-field-label">Buscar</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Usuario, email, IP o user agent"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="md:col-span-4">
            <label className="fni-field-label">Estado</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ALL" | AdminSessionStatus)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
            >
              <option value="ALL">Todos</option>
              <option value="ONLINE">Online</option>
              <option value="IDLE">Idle</option>
              <option value="OFFLINE">Offline</option>
              <option value="REVOKED">Revocadas</option>
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
                <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                <th className="px-4 py-3 text-left font-semibold">Roles</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Última actividad</th>
                <th className="px-4 py-3 text-left font-semibold">Login</th>
                <th className="px-4 py-3 text-left font-semibold">Logout</th>
                <th className="px-4 py-3 text-left font-semibold">IP</th>
                <th className="px-4 py-3 text-left font-semibold">User agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-600">
                    Cargando sesiones...
                  </td>
                </tr>
              ) : visibleSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-600">
                    No hay sesiones para los filtros actuales.
                  </td>
                </tr>
              ) : (
                visibleSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{session.userName}</div>
                      <div className="text-sm text-slate-600">{session.userEmail}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{session.roles.map(roleLabel).join(", ")}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(
                          session.status
                        )}`}
                      >
                        {statusLabel(session.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div>{formatRelative(session.lastSeenAt)}</div>
                      <div className="text-xs text-slate-500">{formatDate(session.lastSeenAt)}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatDate(session.lastLoginAt)}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatDate(session.lastLogoutAt)}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{session.ipAddress ?? "-"}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{session.userAgent ?? "-"}</td>
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
