import { Link, useSearchParams } from "react-router-dom";

import { ROUTES } from "../../app/routes/routeConfig";
import { getUser } from "../../shared/auth";
import { calcIndicatorPct, isIndicatorVisible, statusFromPct } from "../../shared/fni/logic";
import { AREAS_SCHEMA } from "../../shared/fni/schema/evaluacionSchema";
import { defaultIndicatorResponse, defaultSubmissionRecord } from "../../shared/fni/types";
import { useFniWorkspace } from "../../shared/fni/useFniWorkspace";
import { useSchoolDisplayName } from "../../shared/useSchoolDirectory";

// Dashboard del colegio: resume avance, feedback y acciones siguientes para el ciclo activo.
function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function kpiTone(kind: "neutral" | "blue" | "amber" | "green" | "rose") {
  if (kind === "blue") return "border-blue-200 bg-blue-50";
  if (kind === "amber") return "border-amber-200 bg-amber-50";
  if (kind === "green") return "border-emerald-200 bg-emerald-50";
  if (kind === "rose") return "border-rose-200 bg-rose-50";
  return "border-slate-200 bg-white";
}

function barTone(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-blue-500";
  if (pct >= 25) return "bg-amber-500";
  return "bg-rose-500";
}

function submissionBannerTone(status: "borrador" | "enviado" | "devuelto" | "aprobado") {
  if (status === "aprobado") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "devuelto") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "enviado") return "border-blue-200 bg-blue-50 text-blue-900";
  return "border-slate-200 bg-slate-50 text-slate-900";
}

function statusLabel(status: "borrador" | "enviado" | "devuelto" | "aprobado") {
  if (status === "aprobado") return "Aprobado";
  if (status === "devuelto") return "Devuelto con observaciones";
  if (status === "enviado") return "En revisión";
  return "Borrador";
}

function MiniBadge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "amber" | "green" | "rose" | "blue";
}) {
  const map = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone?: "neutral" | "blue" | "amber" | "green" | "rose";
}) {
  return (
    <div className={`fni-metric-card ${kpiTone(tone)}`}>
      <div className="text-sm font-medium text-slate-600">{title}</div>
      <div className="mt-2 text-4xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
    </div>
  );
}

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const user = getUser();

  const cycleId = searchParams.get("cycleId") ?? "2026";
  const schoolId = searchParams.get("schoolId") || user?.schoolId || "sch_1";
  const { schoolLabel } = useSchoolDisplayName(schoolId);
  const { workspace, loading, error, repository } = useFniWorkspace({ schoolId, cycleId });
  const responses = workspace?.responses ?? {};
  const reviews = workspace?.reviews ?? {};
  const submission = workspace?.submission ?? defaultSubmissionRecord();

  const allIndicators = AREAS_SCHEMA.flatMap((area) =>
    area.indicators
      .filter((indicator) => isIndicatorVisible(indicator, responses))
      .map((indicator) => ({
        areaId: area.id,
        areaName: area.name,
        indicator,
        response: responses[indicator.id] ?? defaultIndicatorResponse(),
        review: reviews[indicator.id],
      }))
  );

  const totals = (() => {
    let completos = 0;
    let incompletos = 0;
    let pendientes = 0;
    let observados = 0;
    let bloqueados = 0;

    for (const row of allIndicators) {
      const status = statusFromPct(calcIndicatorPct(row.indicator, row.response));

      if (status === "completo") completos++;
      else if (status === "incompleto") incompletos++;
      else pendientes++;

      if (row.review?.status === "observado") observados++;
      if (row.review?.status === "bloqueado") bloqueados++;
    }

    const total = allIndicators.length;
    const avance = total > 0 ? Math.round((completos / total) * 100) : 0;

    return { total, completos, incompletos, pendientes, observados, bloqueados, avance };
  })();

  const progressByArea = AREAS_SCHEMA.map((area) => {
    const indicators = area.indicators.filter((indicator) => isIndicatorVisible(indicator, responses));
    let completos = 0;
    let pendientes = 0;
    let observados = 0;
    let bloqueados = 0;

    for (const indicator of indicators) {
      const response = responses[indicator.id] ?? defaultIndicatorResponse();
      const review = reviews[indicator.id];
      const status = statusFromPct(calcIndicatorPct(indicator, response));

      if (status === "completo") completos++;
      else pendientes++;

      if (review?.status === "observado") observados++;
      if (review?.status === "bloqueado") bloqueados++;
    }

    const total = indicators.length;
    const pct = total > 0 ? Math.round((completos / total) * 100) : 0;

    return {
      areaId: area.id,
      areaName: area.name,
      total,
      completos,
      pendientes,
      observados,
      bloqueados,
      pct,
    };
  }).sort((a, b) => a.pct - b.pct);

  const recentFeedback = allIndicators
    .filter((row) => row.review && (row.review.status === "observado" || row.review.status === "bloqueado"))
    .sort((a, b) => {
      const aTime = a.review?.reviewedAt ? new Date(a.review.reviewedAt).getTime() : 0;
      const bTime = b.review?.reviewedAt ? new Date(b.review.reviewedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const nextSteps = (() => {
    const steps: Array<{ priority: "Alta" | "Media"; text: string; href: string }> = [];
    const evaluationHref = `${ROUTES.school.evaluation}?cycleId=${encodeURIComponent(
      cycleId
    )}&schoolId=${encodeURIComponent(schoolId)}`;

    // Priorizamos bloqueos y observaciones antes que simples pendientes.
    const blocked = allIndicators.filter((row) => row.review?.status === "bloqueado").slice(0, 2);
    for (const row of blocked) {
      steps.push({
        priority: "Alta",
        text: `Corregir bloqueo en ${row.indicator.name} (${row.areaName})`,
        href: `${evaluationHref}&area=${encodeURIComponent(row.areaId)}&indicator=${encodeURIComponent(
          row.indicator.id
        )}`,
      });
    }

    const observed = allIndicators.filter((row) => row.review?.status === "observado").slice(0, 2);
    for (const row of observed) {
      steps.push({
        priority: "Alta",
        text: `Revisar observación en ${row.indicator.name}`,
        href: `${evaluationHref}&area=${encodeURIComponent(row.areaId)}&indicator=${encodeURIComponent(
          row.indicator.id
        )}`,
      });
    }

    const weakestAreas = progressByArea.filter((area) => area.pendientes > 0).slice(0, 2);
    for (const area of weakestAreas) {
      steps.push({
        priority: "Media",
        text: `Completar pendientes en ${area.areaName} (${area.pendientes})`,
        href: `${evaluationHref}&area=${encodeURIComponent(area.areaId)}`,
      });
    }

    if (!steps.length) {
      steps.push({
        priority: "Media",
        text: "Tu tablero se ve bastante bien. Revisa documentos o exporta un resumen del ciclo.",
        href: `${ROUTES.school.documents}?cycleId=${encodeURIComponent(cycleId)}&schoolId=${encodeURIComponent(
          schoolId
        )}`,
      });
    }

    return steps.slice(0, 4);
  })();

  const documentsHref = `${ROUTES.school.documents}?cycleId=${encodeURIComponent(
    cycleId
  )}&schoolId=${encodeURIComponent(schoolId)}`;
  const evaluationHref = `${ROUTES.school.evaluation}?cycleId=${encodeURIComponent(
    cycleId
  )}&schoolId=${encodeURIComponent(schoolId)}`;

  const onExport = () => {
    const report = {
      schoolId,
      schoolLabel,
      cycleId,
      generatedAt: new Date().toISOString(),
      repositorySource: repository.source,
      submission,
      totals,
      progressByArea,
      recentFeedback: recentFeedback.map((item) => ({
        areaId: item.areaId,
        areaName: item.areaName,
        indicatorId: item.indicator.id,
        indicatorName: item.indicator.name,
        status: item.review?.status ?? null,
        comment: item.review?.reviewComment ?? "",
        reviewedAt: item.review?.reviewedAt ?? null,
      })),
      nextSteps,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dashboard-${schoolId}-${cycleId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="fni-page-kicker">
            {schoolLabel} <span className="mx-2">/</span> Ciclo {cycleId}
          </div>
          <h1 className="fni-page-title">Dashboard colegio</h1>
          <p className="fni-page-subtitle">
            Revisa tu avance, feedback reciente y lo más urgente para cerrar el formulario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to={documentsHref} className="fni-toolbar-button">
            Ver documentos
          </Link>

          <button type="button" onClick={() => void onExport()} className="fni-toolbar-button">
            Exportar
          </button>

          <Link to={evaluationHref} className="fni-toolbar-button-primary">
            Continuar evaluación
          </Link>
        </div>
      </div>

      <div className="fni-data-panel p-4 text-sm text-slate-600">
        Fuente activa: <span className="font-medium text-slate-900">{repository.source}</span>
      </div>

      {loading && !workspace && (
        <div className="fni-data-panel p-6 text-sm text-slate-600">
          Cargando dashboard...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className={`rounded-2xl border p-4 ${submissionBannerTone(submission.status)}`}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold">Estado del ciclo: {statusLabel(submission.status)}</div>
            <div className="mt-1 text-sm">
              {submission.message.trim()
                ? submission.message
                : submission.status === "borrador"
                ? "Tu formulario sigue en edición. Completa los indicadores pendientes y envíalo a revisión."
                : submission.status === "enviado"
                ? "Tu formulario fue enviado y está siendo revisado por Fundación."
                : submission.status === "devuelto"
                ? "Tu formulario recibió observaciones. Corrige lo necesario y vuelve a enviarlo."
                : "Tu formulario fue aprobado para este ciclo."}
            </div>
          </div>

          <div className="text-xs opacity-80">
            Enviado: {formatDate(submission.submittedAt)} / Devuelto: {formatDate(submission.returnedAt)} /
            Aprobado: {formatDate(submission.approvedAt)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <KpiCard
          title="Avance total"
          value={`${totals.avance}%`}
          subtitle={`${totals.completos} de ${totals.total} indicadores completos`}
          tone="blue"
        />
        <KpiCard
          title="Pendientes"
          value={totals.pendientes}
          subtitle="Indicadores aún por responder o completar"
          tone="amber"
        />
        <KpiCard
          title="Observados / bloqueados"
          value={totals.observados + totals.bloqueados}
          subtitle={`${totals.observados} observados / ${totals.bloqueados} bloqueados`}
          tone="rose"
        />
        <KpiCard
          title="Aprobados"
          value={Object.values(reviews).filter((review) => review.status === "aprobado").length}
          subtitle="Indicadores validados por Fundación"
          tone="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Próximos pasos</h2>
            <p className="mt-1 text-sm text-slate-600">Lo más importante para avanzar rápido.</p>
          </div>

          <div className="mt-4 space-y-3">
            {nextSteps.map((step, index) => (
              <div
                key={`${step.text}-${index}`}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3">
                  <MiniBadge tone={step.priority === "Alta" ? "rose" : "blue"}>
                    Prioridad {step.priority}
                  </MiniBadge>
                  <div className="text-sm text-slate-800">{step.text}</div>
                </div>

                <Link
                  to={step.href}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Ir
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Feedback reciente</h2>
          <p className="mt-1 text-sm text-slate-600">Últimas observaciones o bloqueos de Fundación.</p>

          <div className="mt-4 space-y-3">
            {recentFeedback.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Sin feedback reciente. Nada que te persiga por ahora.
              </div>
            ) : (
              recentFeedback.map((item) => (
                <div key={item.indicator.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <MiniBadge tone={item.review?.status === "bloqueado" ? "rose" : "amber"}>
                      {item.review?.status === "bloqueado" ? "Bloqueado" : "Observado"}
                    </MiniBadge>
                    <MiniBadge tone="blue">{item.areaName}</MiniBadge>
                  </div>

                  <div className="mt-2 text-sm font-semibold text-slate-900">{item.indicator.name}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {item.review?.reviewComment?.trim() || "Sin comentario."}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {formatDate(item.review?.reviewedAt ?? null)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Progreso por área</h2>
            <p className="mt-1 text-sm text-slate-600">
              Identifica rápido dónde te conviene seguir trabajando.
            </p>
          </div>

          <Link
            to={evaluationHref}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Abrir evaluación
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {progressByArea.map((area) => (
            <div key={area.areaId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{area.areaName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {area.completos} de {area.total} completos
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {area.pendientes > 0 && <MiniBadge tone="amber">Pendientes: {area.pendientes}</MiniBadge>}
                  {area.observados > 0 && <MiniBadge tone="amber">Observados: {area.observados}</MiniBadge>}
                  {area.bloqueados > 0 && <MiniBadge tone="rose">Bloqueados: {area.bloqueados}</MiniBadge>}
                  {area.pendientes === 0 && area.observados === 0 && area.bloqueados === 0 && (
                    <MiniBadge tone="green">Sin alertas</MiniBadge>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Avance</span>
                  <span>{area.pct}%</span>
                </div>

                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${barTone(area.pct)}`}
                    style={{ width: `${area.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
