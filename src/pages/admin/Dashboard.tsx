import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ROUTES } from "../../app/routes/routeConfig";
import type {
  AdminAuditEventDto,
  AdminSessionDto,
  AdminUserDto,
  CycleSummaryDto,
  SchoolSummaryDto,
} from "../../shared/admin/apiContracts";
import { listAuditEvents, listSchools, listSessions, listUsers } from "../../shared/admin/client";
import {
  closeManagementCycle,
  createManagementCycle,
  getManagementDashboard,
  reopenManagementCycle,
  updateManagementCycle,
} from "../../shared/management/client";
import type { ManagementDashboardDto } from "../../shared/management/apiContracts";
import { normalizeSchoolName } from "../../shared/fni/schools";
import { useCycleOptions } from "../../shared/useCycleOptions";

// Centro de control administrativo: usuarios, sesiones, auditoria y salud del ciclo.
type Tone = "blue" | "amber" | "green" | "rose" | "slate";

function surfaceTone(tone: Tone) {
  if (tone === "blue") return "border-blue-200 bg-blue-50";
  if (tone === "amber") return "border-amber-200 bg-amber-50";
  if (tone === "green") return "border-emerald-200 bg-emerald-50";
  if (tone === "rose") return "border-rose-200 bg-rose-50";
  return "border-slate-200 bg-slate-50";
}

function badgeTone(tone: Tone) {
  if (tone === "blue") return "border-blue-200 bg-blue-50 text-blue-800";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

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

function isSameDay(value: string | null) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function getMetaAction(event: AdminAuditEventDto) {
  const action = event.meta?.action;
  return typeof action === "string" ? action : null;
}

function summarizeAuditEvent(event: AdminAuditEventDto) {
  const action = getMetaAction(event);

  if (action === "USER_CREATED") {
    return `Creó el usuario ${String(event.meta?.targetEmail ?? "nuevo")}.`;
  }

  if (action === "USER_UPDATED") {
    return `Actualizó el usuario ${String(event.meta?.targetEmail ?? "seleccionado")}.`;
  }

  if (action === "USER_PASSWORD_RESET") {
    return `Restableció la contraseña de ${String(event.meta?.targetEmail ?? "un usuario")}.`;
  }

  if (action === "CYCLE_CREATED") {
    return `Abrió ${String(event.meta?.cycleName ?? "un nuevo ciclo")}.`;
  }

  if (action === "CYCLE_UPDATED") {
    return `Actualizó la configuración de ${String(event.meta?.cycleName ?? "un ciclo")}.`;
  }

  if (action === "CYCLE_REOPENED") {
    return `Reabrió ${String(event.meta?.cycleName ?? "el ciclo seleccionado")}.`;
  }

  if (action === "CYCLE_CLOSED") {
    return `Cerró ${String(event.meta?.cycleName ?? "el ciclo seleccionado")}.`;
  }

  if (event.type === "ROLE_SWITCH") {
    return "Cambió el rol activo.";
  }

  if (event.type === "LOGIN") {
    return "Inició sesión.";
  }

  if (event.type === "LOGOUT") {
    return "Cerró sesión.";
  }

  return "Realizó un cambio administrativo.";
}

function eventTone(event: AdminAuditEventDto): Tone {
  const action = getMetaAction(event);

  if (action === "CYCLE_CREATED") return "green";
  if (action === "CYCLE_REOPENED") return "green";
  if (action === "CYCLE_CLOSED") return "blue";
  if (action === "USER_PASSWORD_RESET") return "rose";
  if (event.type === "ROLE_SWITCH") return "amber";
  if (event.type === "CHANGE") return "blue";
  if (event.type === "LOGIN") return "green";
  return "slate";
}

function MetricCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone: Tone;
}) {
  const styles = {
    blue: { shell: "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white", value: "text-blue-700", accent: "bg-blue-500" },
    amber: { shell: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white", value: "text-amber-700", accent: "bg-amber-500" },
    green: { shell: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white", value: "text-emerald-700", accent: "bg-emerald-500" },
    rose: { shell: "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white", value: "text-rose-700", accent: "bg-rose-500" },
    slate: { shell: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white", value: "text-slate-700", accent: "bg-slate-500" },
  }[tone];

  return (
    <div className={`fni-metric-card ${styles.shell}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
        <span className={`mt-1 h-2.5 w-10 rounded-full ${styles.accent}`} />
      </div>
      <div className={`mt-4 text-4xl font-semibold tracking-tight ${styles.value}`}>{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</div>
    </div>
  );
}

type CycleMode = "edit" | "create";
type CycleBusyAction = "create" | "update" | "close" | "reopen";

type CycleFormState = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
};

function formatDateInput(value: string | null) {
  if (!value) return "";

  const dateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (dateMatch) {
    return dateMatch[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCycleFormFromCycle(cycle: CycleSummaryDto): CycleFormState {
  return {
    id: cycle.id,
    name: cycle.name,
    startsAt: formatDateInput(cycle.startsAt),
    endsAt: formatDateInput(cycle.endsAt),
  };
}

function buildNextCycleId(cycles: CycleSummaryDto[]) {
  const numericIds = cycles
    .filter((cycle) => /^\d+$/.test(cycle.id))
    .map((cycle) => Number.parseInt(cycle.id, 10))
    .filter((value) => Number.isFinite(value));

  const baseCandidate =
    numericIds.length > 0 ? Math.max(...numericIds) + 1 : new Date().getFullYear() + 1;
  let candidate = baseCandidate;

  while (cycles.some((cycle) => cycle.id === String(candidate))) {
    candidate += 1;
  }

  return String(candidate);
}

function buildNewCycleForm(cycles: CycleSummaryDto[]): CycleFormState {
  const nextId = buildNextCycleId(cycles);

  return {
    id: nextId,
    name: `Ciclo ${nextId}`,
    startsAt: "",
    endsAt: "",
  };
}

function validateCycleForm(form: CycleFormState, mode: CycleMode) {
  if (mode === "create") {
    const cycleId = form.id.trim();
    if (!cycleId) {
      return "Debes indicar el id del nuevo ciclo.";
    }

    if (!/^[A-Za-z0-9_-]+$/.test(cycleId)) {
      return "El id del ciclo solo puede usar letras, numeros, guiones y guion bajo.";
    }
  }

  if (!form.name.trim()) {
    return "Debes indicar el nombre visible del ciclo.";
  }

  if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) {
    return "La fecha de termino no puede ser anterior a la fecha de inicio.";
  }

  return null;
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cycleId = searchParams.get("cycleId") ?? "2026";
  const [refreshVersion, setRefreshVersion] = useState(0);
  const { cycles, loading: cyclesLoading } = useCycleOptions(cycleId, refreshVersion);

  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [sessions, setSessions] = useState<AdminSessionDto[]>([]);
  const [audit, setAudit] = useState<AdminAuditEventDto[]>([]);
  const [schools, setSchools] = useState<SchoolSummaryDto[]>([]);
  const [dashboard, setDashboard] = useState<ManagementDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPanel() {
      // Este panel consolida varias fuentes para dar contexto rapido al equipo admin.
      setLoading(true);
      setError(null);

      try {
        const [nextUsers, nextSessions, nextAudit, nextSchools, nextDashboard] = await Promise.all([
          listUsers(),
          listSessions(),
          listAuditEvents(),
          listSchools(),
          getManagementDashboard(cycleId),
        ]);

        if (!cancelled) {
          setUsers(nextUsers);
          setSessions(nextSessions);
          setAudit(nextAudit);
          setSchools(nextSchools);
          setDashboard(nextDashboard);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "No se pudo cargar el centro de control."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPanel();

    return () => {
      cancelled = true;
    };
  }, [cycleId, refreshVersion]);

  const cycle = dashboard?.cycle ?? null;
  const cycleSchools = useMemo(() => dashboard?.schools ?? [], [dashboard?.schools]);
  const cycleIssues = useMemo(() => dashboard?.issues ?? [], [dashboard?.issues]);
  const cycleOptions = useMemo(
    () =>
      cycles.length > 0
        ? cycles
        : [
            {
              id: cycleId,
              name: cycle ? cycle.name : `Ciclo ${cycleId}`,
              status: cycle?.status ?? "OPEN",
              startsAt: cycle?.startsAt ?? null,
              endsAt: cycle?.endsAt ?? null,
              closedAt: cycle?.closedAt ?? null,
              isClosed: cycle?.isClosed ?? false,
            },
          ],
    [cycle, cycleId, cycles]
  );
  const [cycleMode, setCycleMode] = useState<CycleMode>("edit");
  const [cycleForm, setCycleForm] = useState<CycleFormState>(() => buildNewCycleForm(cycleOptions));
  const [cycleBusyAction, setCycleBusyAction] = useState<CycleBusyAction | null>(null);
  const [cycleActionError, setCycleActionError] = useState<string | null>(null);
  const [cycleActionNotice, setCycleActionNotice] = useState<string | null>(null);
  const isCycleBusy = cycleBusyAction !== null;
  const isClosedSelectedCycle = cycleMode === "edit" && Boolean(cycle?.isClosed);
  const cycleFieldsDisabled = isCycleBusy || isClosedSelectedCycle;

  useEffect(() => {
    if (cycleMode === "edit" && cycle) {
      setCycleForm(buildCycleFormFromCycle(cycle));
    }
  }, [cycle, cycleMode]);

  const usersSummary = useMemo(() => {
    const active = users.filter((user) => user.status === "ACTIVE").length;
    const invited = users.filter((user) => user.status === "INVITED").length;
    const disabled = users.filter((user) => user.status === "DISABLED").length;
    const admins = users.filter((user) => user.roles.includes("ADMIN")).length;

    return { active, invited, disabled, admins };
  }, [users]);

  const sessionsSummary = useMemo(() => {
    const online = sessions.filter((session) => session.status === "ONLINE").length;
    const idle = sessions.filter((session) => session.status === "IDLE").length;
    const revoked = sessions.filter((session) => session.status === "REVOKED").length;

    return { online, idle, revoked };
  }, [sessions]);

  const governanceSummary = useMemo(() => {
    const submittedCount = cycleSchools.filter((school) => school.submitted).length;
    const noSubmissionCount = cycleSchools.length - submittedCount;
    const blockedSchools = cycleSchools.filter((school) => school.blockingCount > 0).length;
    const schoolsWithMissingEvidence = cycleSchools.filter(
      (school) => (school.missingEvidenceCount ?? 0) > 0
    );
    const missingEvidenceTotal = schoolsWithMissingEvidence.reduce(
      (accumulator, school) => accumulator + (school.missingEvidenceCount ?? 0),
      0
    );
    const schoolsWithoutManager = schools.filter(
      (school) => !school.managerName || !school.managerEmail
    ).length;
    const schoolUsersWithoutSchool = users.filter(
      (user) => user.roles.includes("COLEGIO") && !user.schoolId
    ).length;

    return {
      submittedCount,
      noSubmissionCount,
      blockedSchools,
      schoolsWithMissingEvidence,
      missingEvidenceTotal,
      schoolsWithoutManager,
      schoolUsersWithoutSchool,
    };
  }, [cycleSchools, schools, users]);

  const auditSummary = useMemo(() => {
    const sensitiveEvents = audit.filter(
      (event) => event.type === "CHANGE" || event.type === "ROLE_SWITCH"
    );
    const todaySensitive = sensitiveEvents.filter((event) => isSameDay(event.at)).length;

    return {
      sensitiveEvents,
      todaySensitive,
    };
  }, [audit]);

  const documentQueue = useMemo(() => {
    return [...cycleSchools]
      .filter((school) => (school.missingEvidenceCount ?? 0) > 0)
      .sort((left, right) => (right.missingEvidenceCount ?? 0) - (left.missingEvidenceCount ?? 0))
      .slice(0, 5);
  }, [cycleSchools]);

  const adminQueue = useMemo(() => {
    const items = [
      {
        key: "issues",
        title: `${cycleIssues.length} temas del ciclo requieren seguimiento`,
        description: "Observaciones y bloqueos abiertos que deben destrabarse desde la operación.",
        href: `${ROUTES.foundation.dashboard}?cycleId=${encodeURIComponent(cycleId)}`,
        action: "Abrir dashboard",
        tone: cycleIssues.length > 0 ? ("amber" as const) : ("slate" as const),
        visible: cycleIssues.length > 0,
      },
      {
        key: "submissions",
        title: `${governanceSummary.noSubmissionCount} colegios siguen sin envío`,
        description: "Aún no enviaron formulario en el ciclo seleccionado.",
        href: `${ROUTES.foundation.schools}?cycleId=${encodeURIComponent(cycleId)}`,
        action: "Ver colegios",
        tone: governanceSummary.noSubmissionCount > 0 ? ("rose" as const) : ("slate" as const),
        visible: governanceSummary.noSubmissionCount > 0,
      },
      {
        key: "invites",
        title: `${usersSummary.invited} usuarios invitados pendientes`,
        description: "Invitaciones activas que todavía no completan acceso.",
        href: ROUTES.admin.users,
        action: "Gestionar usuarios",
        tone: usersSummary.invited > 0 ? ("amber" as const) : ("slate" as const),
        visible: usersSummary.invited > 0,
      },
      {
        key: "manager",
        title: `${governanceSummary.schoolsWithoutManager} colegios sin encargado completo`,
        description: "Falta nombre o correo de contacto para seguimiento operativo.",
        href: `${ROUTES.foundation.schools}?cycleId=${encodeURIComponent(cycleId)}`,
        action: "Revisar colegios",
        tone:
          governanceSummary.schoolsWithoutManager > 0 ? ("amber" as const) : ("slate" as const),
        visible: governanceSummary.schoolsWithoutManager > 0,
      },
      {
        key: "sessions",
        title: `${sessionsSummary.revoked} sesiones revocadas requieren revisión`,
        description: "Cambios de acceso o reinicios recientes pueden necesitar seguimiento.",
        href: ROUTES.admin.sessions,
        action: "Ver sesiones",
        tone: sessionsSummary.revoked > 0 ? ("blue" as const) : ("slate" as const),
        visible: sessionsSummary.revoked > 0,
      },
      {
        key: "mapping",
        title: `${governanceSummary.schoolUsersWithoutSchool} usuarios colegio sin asignación`,
        description: "Inconsistencia de datos que conviene corregir antes de operar.",
        href: ROUTES.admin.users,
        action: "Corregir usuarios",
        tone:
          governanceSummary.schoolUsersWithoutSchool > 0 ? ("rose" as const) : ("slate" as const),
        visible: governanceSummary.schoolUsersWithoutSchool > 0,
      },
      {
        key: "documents",
        title: `${governanceSummary.schoolsWithMissingEvidence.length} colegios con evidencia pendiente`,
        description: `${governanceSummary.missingEvidenceTotal} archivos faltantes en el ciclo seleccionado.`,
        href: `${ROUTES.foundation.schools}?cycleId=${encodeURIComponent(cycleId)}`,
        action: "Abrir colegios",
        tone:
          governanceSummary.schoolsWithMissingEvidence.length > 0
            ? ("amber" as const)
            : ("slate" as const),
        visible: governanceSummary.schoolsWithMissingEvidence.length > 0,
      },
    ];

    return items.filter((item) => item.visible);
  }, [
    cycleId,
    cycleIssues.length,
    governanceSummary.noSubmissionCount,
    governanceSummary.missingEvidenceTotal,
    governanceSummary.schoolsWithoutManager,
    governanceSummary.schoolsWithMissingEvidence.length,
    governanceSummary.schoolUsersWithoutSchool,
    sessionsSummary.revoked,
    usersSummary.invited,
  ]);

  const quickActions = useMemo(() => {
    return [
      {
        title: "Dashboard del ciclo",
        description: "Operación del ciclo, colegios críticos y revisión priorizada.",
        href: `${ROUTES.foundation.dashboard}?cycleId=${encodeURIComponent(cycleId)}`,
        action: "Abrir dashboard",
      },
      {
        title: "Colegios",
        description: "Seguimiento de envíos, estados y accesos por establecimiento.",
        href: `${ROUTES.foundation.schools}?cycleId=${encodeURIComponent(cycleId)}`,
        action: "Ver colegios",
      },
      {
        title: "Usuarios",
        description: "Altas, roles, activación de acceso y restablecimiento de contraseñas.",
        href: ROUTES.admin.users,
        action: "Gestionar usuarios",
      },
      {
        title: "Auditoría",
        description: "Rastreo de cambios sensibles, ingresos y operaciones de control.",
        href: ROUTES.admin.audit,
        action: "Abrir auditoría",
      },
      {
        title: "Documentos del ciclo",
        description: "Acceso directo a los colegios con archivos faltantes o pendientes de revisión.",
        href: `${ROUTES.foundation.schools}?cycleId=${encodeURIComponent(cycleId)}`,
        action: "Ver documentos",
      },
    ];
  }, [cycleId]);

  const recentSensitiveEvents = useMemo(() => {
    return auditSummary.sensitiveEvents.slice(0, 5);
  }, [auditSummary.sensitiveEvents]);

  const onCycleChange = (nextCycle: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("cycleId", nextCycle);
    setSearchParams(nextSearchParams);
    setCycleMode("edit");
    setCycleActionError(null);
    setCycleActionNotice(null);
  };

  const onRefresh = () => {
    setRefreshVersion((current) => current + 1);
  };

  const beginCreateCycle = () => {
    setCycleMode("create");
    setCycleForm(buildNewCycleForm(cycles));
    setCycleActionError(null);
    setCycleActionNotice(null);
  };

  const restoreSelectedCycle = () => {
    if (!cycle) return;

    setCycleMode("edit");
    setCycleForm(buildCycleFormFromCycle(cycle));
    setCycleActionError(null);
    setCycleActionNotice(null);
  };

  const onCycleFormChange = (patch: Partial<CycleFormState>) => {
    setCycleForm((current) => ({
      ...current,
      ...patch,
    }));
  };

  const onSaveCycle = async () => {
    if (cycleMode === "edit" && cycle?.isClosed) {
      setCycleActionError("El ciclo esta cerrado. Debe reabrirse antes de editar su configuracion.");
      setCycleActionNotice(null);
      return;
    }

    const validationError = validateCycleForm(cycleForm, cycleMode);
    if (validationError) {
      setCycleActionError(validationError);
      setCycleActionNotice(null);
      return;
    }

    setCycleBusyAction(cycleMode === "create" ? "create" : "update");
    setCycleActionError(null);
    setCycleActionNotice(null);

    try {
      if (cycleMode === "create") {
        const created = await createManagementCycle({
          id: cycleForm.id.trim(),
          name: cycleForm.name.trim(),
          startsAt: cycleForm.startsAt || null,
          endsAt: cycleForm.endsAt || null,
        });

        setDashboard((current) => ({
          cycle: created,
          schools: current && current.cycle.id === created.id ? current.schools : [],
          issues: current && current.cycle.id === created.id ? current.issues : [],
        }));
        setCycleForm(buildCycleFormFromCycle(created));
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set("cycleId", created.id);
        setSearchParams(nextSearchParams);
        setCycleMode("edit");
        setCycleActionNotice(`Ciclo ${created.name} creado y abierto correctamente.`);
        setRefreshVersion((current) => current + 1);
        return;
      }

      if (!cycle) return;

      const updated = await updateManagementCycle(cycle.id, {
        name: cycleForm.name.trim(),
        startsAt: cycleForm.startsAt || null,
        endsAt: cycleForm.endsAt || null,
      });

      setDashboard((current) => (current ? { ...current, cycle: updated } : current));
      setCycleForm(buildCycleFormFromCycle(updated));
      setCycleActionNotice(`Configuracion de ${updated.name} actualizada.`);
      setRefreshVersion((current) => current + 1);
    } catch (saveError) {
      setCycleActionError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar el ciclo."
      );
    } finally {
      setCycleBusyAction(null);
    }
  };

  const onCloseCycle = async () => {
    if (!cycle || cycle.isClosed) return;

    setCycleBusyAction("close");
    setCycleActionError(null);
    setCycleActionNotice(null);

    try {
      const closed = await closeManagementCycle(cycle.id);
      setDashboard((current) => (current ? { ...current, cycle: closed } : current));
      setCycleForm(buildCycleFormFromCycle(closed));
      setCycleActionNotice(`${closed.name} fue cerrado correctamente.`);
      setRefreshVersion((current) => current + 1);
    } catch (closeError) {
      setCycleActionError(
        closeError instanceof Error ? closeError.message : "No se pudo cerrar el ciclo."
      );
    } finally {
      setCycleBusyAction(null);
    }
  };

  const onReopenCycle = async () => {
    if (!cycle || !cycle.isClosed) return;

    setCycleBusyAction("reopen");
    setCycleActionError(null);
    setCycleActionNotice(null);

    try {
      const reopened = await reopenManagementCycle(cycle.id);
      setDashboard((current) => (current ? { ...current, cycle: reopened } : current));
      setCycleForm(buildCycleFormFromCycle(reopened));
      setCycleActionNotice(`${reopened.name} fue reabierto correctamente.`);
      setRefreshVersion((current) => current + 1);
    } catch (reopenError) {
      setCycleActionError(
        reopenError instanceof Error ? reopenError.message : "No se pudo reabrir el ciclo."
      );
    } finally {
      setCycleBusyAction(null);
    }
  };

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="fni-page-kicker">
            Administración <span className="mx-2">/</span> Centro de control
          </div>
          <h1 className="fni-page-title">Centro de control administrativo</h1>
          <p className="fni-page-subtitle">
            Gobierno del sistema, riesgos operativos y accesos rápidos sin duplicar usuarios,
            sesiones ni auditoría.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cycleId}
            onChange={(event) => onCycleChange(event.target.value)}
            disabled={cyclesLoading}
            className="fni-cycle-select"
            aria-label="Ciclo"
            title="Ciclo"
          >
            {cycleOptions.map((cycleOption) => (
              <option key={cycleOption.id} value={cycleOption.id}>
                {cycleOption.name}
              </option>
            ))}
          </select>

          <button type="button" onClick={onRefresh} className="fni-toolbar-button">
            Refrescar
          </button>

          <button
            type="button"
            onClick={beginCreateCycle}
            disabled={loading || cyclesLoading || isCycleBusy}
            className={cycleMode === "create" ? "fni-toolbar-button" : "fni-toolbar-button-primary"}
          >
            {cycleMode === "create" ? "Nuevo ciclo en edicion" : "Nuevo ciclo"}
          </button>

          <Link
            to={`${ROUTES.foundation.dashboard}?cycleId=${encodeURIComponent(cycleId)}`}
            className="fni-toolbar-button"
          >
            Abrir dashboard
          </Link>
        </div>
      </div>

      {loading && (
        <div className="fni-data-panel p-6 text-sm text-slate-600">Cargando centro de control...</div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      {!loading && !error && !cycle && (
        <div className="fni-empty-state-panel">No encontramos información para el ciclo seleccionado.</div>
      )}

      {!loading && cycle && (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <MetricCard
              title="Ciclos configurados"
              value={cycles.length}
              subtitle={cycle.isClosed ? `${cycle.name} está cerrado` : `${cycle.name} sigue operativo`}
              tone="blue"
            />
            <MetricCard
              title="Usuarios activos"
              value={usersSummary.active}
              subtitle={`${usersSummary.invited} invitados / ${usersSummary.disabled} deshabilitados`}
              tone="green"
            />
            <MetricCard
              title="Sesiones con actividad"
              value={sessionsSummary.online + sessionsSummary.idle}
              subtitle={`${sessionsSummary.online} online / ${sessionsSummary.idle} inactivas`}
              tone="amber"
            />
            <MetricCard
              title="Cambios sensibles hoy"
              value={auditSummary.todaySensitive}
              subtitle={`${usersSummary.admins} usuarios con rol administrador`}
              tone="rose"
            />
            <MetricCard
              title="Evidencias faltantes"
              value={governanceSummary.missingEvidenceTotal}
              subtitle={`${governanceSummary.schoolsWithMissingEvidence.length} colegios con documentos pendientes`}
              tone="amber"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Cola administrativa</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Pendientes transversales del sistema que no viven en una sola pantalla.
                  </p>
                </div>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone(
                    adminQueue.length > 0 ? "amber" : "green"
                  )}`}
                >
                  {adminQueue.length > 0 ? `${adminQueue.length} focos activos` : "Sin focos urgentes"}
                </span>
              </div>

              {adminQueue.length === 0 ? (
                <div className="fni-empty-state-panel mt-4 min-h-[200px]">
                  No hay alertas administrativas relevantes. El sistema está consistente para el
                  ciclo seleccionado.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {adminQueue.map((item) => (
                    <div key={item.key} className={`rounded-2xl border p-4 ${surfaceTone(item.tone)}`}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                          <div className="mt-1 text-sm text-slate-600">{item.description}</div>
                        </div>

                        <Link to={item.href} className="fni-toolbar-button whitespace-nowrap">
                          {item.action}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Gestion de ciclos</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Resumen operativo y consola editable del ciclo seleccionado.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone(
                      cycle.isClosed ? "slate" : "blue"
                    )}`}
                  >
                    {cycle.isClosed ? "Cerrado" : "Activo"}
                  </span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone(
                      "green"
                    )}`}
                  >
                    {cycleSchools.length} colegios
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-1 gap-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-4">
                    <span>Nombre del ciclo</span>
                    <span className="font-semibold text-slate-900">{cycle.name}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Inicio</span>
                    <span className="font-semibold text-slate-900">{formatDate(cycle.startsAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Término</span>
                    <span className="font-semibold text-slate-900">{formatDate(cycle.endsAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Cierre registrado</span>
                    <span className="font-semibold text-slate-900">{formatDate(cycle.closedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Colegios con envío</span>
                    <span className="font-semibold text-slate-900">
                      {governanceSummary.submittedCount}/{cycleSchools.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Observaciones abiertas</span>
                    <span className="font-semibold text-slate-900">{cycleIssues.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Colegios bloqueados</span>
                    <span className="font-semibold text-slate-900">{governanceSummary.blockedSchools}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <Link
                  to={`${ROUTES.foundation.dashboard}?cycleId=${encodeURIComponent(cycleId)}`}
                  className="fni-toolbar-button text-center"
                >
                  Ir al dashboard del ciclo
                </Link>
                <Link
                  to={`${ROUTES.foundation.schools}?cycleId=${encodeURIComponent(cycleId)}`}
                  className="fni-toolbar-button text-center"
                >
                  Ver colegios del ciclo
                </Link>
              </div>

              {cycleActionError && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  {cycleActionError}
                </div>
              )}

              {cycleActionNotice && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  {cycleActionNotice}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone(
                      cycleMode === "create" ? "amber" : cycle.isClosed ? "green" : "blue"
                    )}`}
                  >
                    {cycleMode === "create" ? "Nuevo ciclo" : cycle.isClosed ? "Cerrado" : "Activo"}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {cycleMode === "create"
                      ? "Preparando un nuevo ciclo."
                      : "Edita nombre y fechas, o cambia su estado."}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="fni-field-label">Id del ciclo</label>
                      <input
                        value={cycleForm.id}
                        disabled={cycleMode === "edit" || isCycleBusy}
                        onChange={(event) => onCycleFormChange({ id: event.target.value })}
                        className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                          cycleMode === "edit" || isCycleBusy
                            ? "cursor-not-allowed bg-slate-100 text-slate-500"
                            : "bg-white"
                        }`}
                        placeholder="2027"
                      />
                    </div>

                    <div>
                      <label className="fni-field-label">Nombre visible</label>
                      <input
                        value={cycleForm.name}
                        disabled={cycleFieldsDisabled}
                        onChange={(event) => onCycleFormChange({ name: event.target.value })}
                        className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                          cycleFieldsDisabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "bg-white"
                        }`}
                        placeholder="Ciclo 2027"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="fni-field-label">Fecha de inicio</label>
                      <input
                        type="date"
                        value={cycleForm.startsAt}
                        disabled={cycleFieldsDisabled}
                        onChange={(event) => onCycleFormChange({ startsAt: event.target.value })}
                        className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                          cycleFieldsDisabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "bg-white"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="fni-field-label">Fecha de termino</label>
                      <input
                        type="date"
                        value={cycleForm.endsAt}
                        disabled={cycleFieldsDisabled}
                        onChange={(event) => onCycleFormChange({ endsAt: event.target.value })}
                        className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                          cycleFieldsDisabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "bg-white"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void onSaveCycle()}
                      disabled={isCycleBusy || isClosedSelectedCycle}
                      className={
                        isCycleBusy || isClosedSelectedCycle
                          ? "fni-toolbar-button opacity-70"
                          : "fni-toolbar-button-primary"
                      }
                    >
                      {cycleBusyAction === "create"
                        ? "Abriendo ciclo..."
                        : cycleBusyAction === "update"
                        ? "Guardando..."
                        : cycleMode === "create"
                        ? "Abrir ciclo"
                        : cycle.isClosed
                        ? "Ciclo cerrado"
                        : "Guardar configuracion"}
                    </button>

                    {cycleMode === "create" ? (
                      <button
                        type="button"
                        onClick={restoreSelectedCycle}
                        disabled={isCycleBusy}
                        className="fni-toolbar-button"
                      >
                        Cancelar nuevo ciclo
                      </button>
                    ) : cycle.isClosed ? (
                      <button
                        type="button"
                        onClick={() => void onReopenCycle()}
                        disabled={isCycleBusy}
                        className="fni-toolbar-button"
                      >
                        {cycleBusyAction === "reopen" ? "Reabriendo..." : "Reabrir ciclo"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onCloseCycle()}
                        disabled={isCycleBusy}
                        className="fni-toolbar-button"
                      >
                        {cycleBusyAction === "close" ? "Cerrando..." : "Cerrar ciclo"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Control documental</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Colegios con evidencias faltantes y acceso directo a sus documentos.
                </p>
              </div>

              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone(
                  documentQueue.length > 0 ? "amber" : "green"
                )}`}
              >
                {documentQueue.length > 0
                  ? `${documentQueue.length} colegios con faltantes visibles`
                  : "Sin faltantes documentales"}
              </span>
            </div>

            {documentQueue.length === 0 ? (
              <div className="fni-empty-state-panel mt-4 min-h-[160px]">
                No hay colegios con evidencias faltantes en el ciclo seleccionado.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {documentQueue.map((school) => (
                  <div
                    key={school.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{school.code}</div>
                        <div className="mt-1 text-sm text-slate-700">{school.name}</div>
                      </div>

                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                        {school.missingEvidenceCount} faltantes
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      Completitud: {Math.round(school.completionPct)}% / Estado: {school.status}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to={`/foundation/schools/${encodeURIComponent(
                          school.id
                        )}/documents?cycleId=${encodeURIComponent(
                          cycleId
                        )}&schoolLabel=${encodeURIComponent(`${school.code} - ${normalizeSchoolName(school.code, school.name)}`)}`}
                        className="fni-toolbar-button"
                      >
                        Ver documentos
                      </Link>
                      <Link
                        to={`/foundation/schools/${encodeURIComponent(
                          school.id
                        )}/review?cycleId=${encodeURIComponent(
                          cycleId
                        )}&schoolLabel=${encodeURIComponent(`${school.code} - ${normalizeSchoolName(school.code, school.name)}`)}`}
                        className="fni-toolbar-button"
                      >
                        Ir a revisión
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Acciones rápidas</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Atajos hacia las pantallas especializadas para ejecutar cambios.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.title}
                    to={action.href}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{action.title}</div>
                        <div className="mt-1 text-sm text-slate-600">{action.description}</div>
                      </div>

                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                        {action.action}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Actividad sensible reciente</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Muestra breve de cambios administrativos para decidir si profundizar en auditoría.
                  </p>
                </div>

                <Link to={ROUTES.admin.audit} className="fni-toolbar-button">
                  Ver auditoría
                </Link>
              </div>

              {recentSensitiveEvents.length === 0 ? (
                <div className="fni-empty-state-panel mt-4 min-h-[220px]">
                  No hay cambios sensibles recientes para mostrar.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentSensitiveEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">{event.actorName}</div>
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone(
                                eventTone(event)
                              )}`}
                            >
                              {getMetaAction(event) ?? event.type}
                            </span>
                          </div>

                          <div className="mt-1 text-sm text-slate-600">{summarizeAuditEvent(event)}</div>
                          <div className="mt-2 text-xs text-slate-500">
                            {event.actorEmail} / {formatDate(event.at)}
                          </div>
                        </div>

                        <div className="text-xs font-medium text-slate-500">
                          {formatRelative(event.at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
