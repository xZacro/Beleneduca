import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import belenLogo from "../assets/belen-logo.png";
import { getHomeForUser } from "../app/routes/home";
import { login, requestPasswordRecovery } from "../shared/auth";

const features = [
  {
    title: "Acceso por perfil",
    description: "Administración, fundación y colegio en un mismo lugar.",
    accent: "bg-sky-50 text-sky-700",
    icon: "shield",
  },
  {
    title: "Seguimiento institucional",
    description: "Seguimiento de documentos, ciclos y observaciones.",
    accent: "bg-emerald-50 text-emerald-700",
    icon: "document",
  },
  {
    title: "Una sola plataforma",
    description: "Ciclos, evidencias y revisión en un solo espacio.",
    accent: "bg-violet-50 text-violet-700",
    icon: "folder",
  },
] as const;

function IconEnvelope() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M4 6h16v12H4V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m4.5 7 7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M7.5 11V8.5a4.5 4.5 0 0 1 9 0V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 11h12v8H6v-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.8" />
      {hidden && <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

function FeatureIcon({ kind }: { kind: (typeof features)[number]["icon"] }) {
  if (kind === "shield") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M12 3 19 6v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M9.5 12.5 11 14l3.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "document") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path d="M7 3h7l5 5v13H7V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 13h6M9 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3.2l1.7 1.8H18A2.5 2.5 0 0 1 20.5 9.3v8.2A2.5 2.5 0 0 1 18 20H6.5A2.5 2.5 0 0 1 4 17.5v-10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Illustration() {
  return (
    <div className="relative mx-auto flex min-h-[180px] w-full max-w-[250px] items-center justify-start px-0">
      <div className="absolute left-0 top-3 h-14 w-14 rounded-full bg-sky-100/70 blur-3xl" />
      <div className="absolute right-0 top-8 h-16 w-16 rounded-full bg-amber-100/60 blur-3xl" />
      <div className="absolute left-4 bottom-4 h-12 w-12 rounded-full bg-violet-100/55 blur-3xl" />

      <div
        className="absolute left-0 top-7 h-[148px] w-[206px] rounded-[2rem] border border-dashed border-slate-200/80"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(148,163,184,0.20) 1.3px, transparent 1.3px), radial-gradient(circle, rgba(148,163,184,0.12) 1.1px, transparent 1.1px)",
          backgroundPosition: "0 0, 12px 12px",
          backgroundSize: "24px 24px, 24px 24px",
        }}
      />

      <div className="relative h-[176px] w-[214px]">
        <div className="absolute left-2 top-6 h-[92px] w-[76px] rounded-[1.6rem] border border-slate-100 bg-white shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
          <div className="px-4 pt-4">
            <div className="h-2 w-12 rounded-full bg-sky-100" />
            <div className="mt-2 h-2 w-7 rounded-full bg-sky-100" />
          </div>
          <div className="absolute left-1/2 top-[42px] grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full bg-sky-500 text-white shadow-[0_10px_20px_rgba(37,99,235,0.24)]">
            <span className="text-base font-semibold leading-none">✓</span>
          </div>
        </div>

        <div className="absolute left-3 top-[108px] h-[72px] w-[76px] rounded-[1.6rem] border border-slate-100 bg-white shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
          <div className="px-2.5 pt-2.5">
            <div className="h-2 w-10 rounded-full bg-slate-100" />
            <div className="mt-2 flex items-end gap-1.5">
              <div className="h-5 w-3.5 rounded-t-lg bg-sky-100" />
              <div className="h-8 w-3.5 rounded-t-lg bg-sky-200" />
              <div className="h-4 w-3.5 rounded-t-lg bg-sky-100" />
              <div className="h-[38px] w-3.5 rounded-t-lg bg-sky-300" />
            </div>
          </div>
        </div>

        <div className="absolute left-[78px] top-[76px] h-[40px] w-[40px] rounded-[1rem] bg-gradient-to-b from-amber-200 to-amber-400 shadow-[0_14px_28px_rgba(245,158,11,0.18)]" />

        <div className="absolute left-[110px] top-[94px] h-[72px] w-[78px] rounded-[1.6rem] border border-slate-100 bg-white shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
          <div className="px-3 pt-3">
            <div className="h-2 w-5 rounded-full bg-slate-100" />
            <div className="mt-2 h-2 w-3.5 rounded-full bg-slate-100" />
            <div className="mt-2 h-8 rounded-2xl bg-gradient-to-br from-sky-50 via-sky-100 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("ebravo@outlook.cl");
  const [password, setPassword] = useState("demo");
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");
  const [helpStatus, setHelpStatus] = useState<string | null>(null);
  const [helpSending, setHelpSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const user = await login(email, password);
      if (!user) {
        setError("Correo o contraseña incorrectos.");
        return;
      }

      navigate(getHomeForUser(user), { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pudimos iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  const openRecoveryRequest = () => {
    setHelpMessage("");
    setHelpStatus(null);
    setHelpOpen(true);
  };

  const sendRecoveryRequest = async () => {
    setHelpSending(true);
    setHelpStatus(null);

    try {
      await requestPasswordRecovery(email, helpMessage);
      setHelpStatus("Solicitud enviada a administración. Te contactaremos por el correo institucional.");
      setHelpMessage("");
    } catch (sendError) {
      setHelpStatus(
        sendError instanceof Error ? sendError.message : "No se pudo enviar la solicitud. Inténtalo de nuevo.",
      );
    } finally {
      setHelpSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(241,245,249,1)_44%,rgba(226,232,240,0.92)_100%)]">
      <div className="fni-brand-ribbon h-4 w-full" />

      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
        <div className="grid gap-6 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1.1fr_0.82fr] lg:items-stretch">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.08),transparent_24%)]" />

            <div className="relative flex h-full flex-col">
              <div className="grid gap-6 lg:grid-cols-[0.28fr_0.72fr] lg:items-start lg:gap-7">
                <div className="space-y-2.5">
                  <div className="flex justify-start lg:pt-1">
                    <img src={belenLogo} alt="Fundación Belén Educa" className="h-14 w-auto max-w-[220px] object-contain" />
                  </div>
                  <Illustration />
                </div>

                <div className="lg:pt-2">
                  <div className="text-[0.74rem] font-semibold uppercase tracking-[0.32em] text-blue-700">
                    Fortalecimiento Normativo Institucional
                  </div>
                  <h1 className="mt-3 max-w-[10ch] text-[2.5rem] font-semibold leading-[0.95] tracking-tight text-slate-900 sm:text-[3.35rem]">
                    FNI
                  </h1>
                  <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
                    Acceso institucional para gestionar ciclos, formularios, documentos y revisiones según tu perfil.
                  </p>
                </div>
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-3 lg:mt-16">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
                  >
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${feature.accent}`}>
                      <FeatureIcon kind={feature.icon} />
                    </div>
                    <div className="mt-4 text-sm font-semibold text-slate-900">{feature.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</div>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500">
                <div className="inline-flex items-center gap-2">
                  <span className="text-slate-400">◌</span>
                  Plataforma segura y confiable
                </div>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">Colegio</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                  Fundación
                </span>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700">
                  Administración
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                  PDF y auditoría
                </span>
              </div>
            </div>
          </section>

          <section className="flex items-stretch justify-center">
            <div className="flex w-full max-w-[500px] flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.10)] sm:p-7">
              <div className="flex justify-center">
                <img src={belenLogo} alt="Fundación Belén Educa" className="h-16 w-auto max-w-[300px] object-contain" />
              </div>

              <div className="mt-6">
                <div className="text-[0.74rem] font-semibold uppercase tracking-[0.28em] text-blue-700">Acceso de usuarios</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Ingresa a la plataforma</div>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Usa tu correo institucional para entrar según tu perfil y seguir con el trabajo del ciclo.
                </p>
              </div>

              <form className="mt-8 grid gap-4" onSubmit={(event) => void onSubmit(event)}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Correo institucional</label>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-blue-200 focus-within:ring-4 focus-within:ring-blue-100">
                    <span className="text-slate-400">
                      <IconEnvelope />
                    </span>
                    <input
                      className="w-full bg-transparent outline-none placeholder:text-slate-400"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="usuario@beleneduca.cl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Contraseña</label>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-blue-200 focus-within:ring-4 focus-within:ring-blue-100">
                    <span className="text-slate-400">
                      <IconLock />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full bg-transparent outline-none placeholder:text-slate-400"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      <IconEye hidden={!showPassword} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <label className="flex items-center gap-2 text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberSession}
                      onChange={(event) => setRememberSession(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                    Recordar mi sesión
                  </label>

                  <button
                    type="button"
                    onClick={openRecoveryRequest}
                    className="font-semibold text-blue-700 transition hover:text-blue-800"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span>{submitting ? "Ingresando..." : "Ingresar"}</span>
                  <span className="text-lg leading-none">→</span>
                </button>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-slate-500">
                  El acceso se valida y tus datos se cargan según tu perfil.
                </div>
              </form>

              {helpOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
                  <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.25)]">
                    <div className="text-[0.74rem] font-semibold uppercase tracking-[0.28em] text-blue-700">
                      Soporte de acceso
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                      Solicitar recuperación de contraseña
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      La recuperación la gestiona el equipo de administración. Cuéntanos brevemente qué pasó y
                      enviaremos tu solicitud.
                    </p>

                    <div className="mt-5 space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Correo institucional</label>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {email || "usuario@beleneduca.cl"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Detalle opcional</label>
                        <textarea
                          className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-200 focus:ring-4 focus:ring-blue-100"
                          value={helpMessage}
                          onChange={(event) => setHelpMessage(event.target.value)}
                          placeholder="Cuéntanos qué ocurrió o si necesitas resetear el acceso."
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setHelpOpen(false)}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cerrar
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendRecoveryRequest()}
                        disabled={helpSending}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {helpSending ? "Enviando..." : "Enviar"}
                      </button>
                    </div>
                    {helpStatus && (
                      <div
                        className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                          helpStatus.toLowerCase().includes("enviada")
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {helpStatus}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
