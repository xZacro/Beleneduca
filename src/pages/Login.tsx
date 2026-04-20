import { useState } from "react";
import { useNavigate } from "react-router-dom";

import belenLogo from "../assets/belen-logo.png";
import { getHomeForUser } from "../app/routes/home";
import { login } from "../shared/auth";

const features = [
  "Acceso por perfil: administración, fundación y colegio.",
  "Seguimiento institucional con trazabilidad de documentos.",
  "Ciclos, observaciones y evidencias en una sola plataforma.",
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("fundacion.01@demo.cl");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const user = await login(email, password);
      if (!user) {
        setError("Credenciales inválidas o sesión no disponible.");
        return;
      }

      navigate(getHomeForUser(user), { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="fni-brand-ribbon h-4 w-full" />

      <div className="mx-auto grid min-h-[calc(100vh-0.75rem)] max-w-7xl place-items-center px-4 py-8 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(234,88,12,0.08),transparent_24%)]" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="flex items-center gap-4">
                <div className="fni-logo-shell fni-logo-shell-header">
                  <img src={belenLogo} alt="Belen Educa" className="h-14 w-auto max-w-[260px] object-contain" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Fundación Belén Educa</div>
                  <div className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Gestor Documental</div>
                  <div className="mt-2 max-w-xl text-base leading-7 text-slate-600">
                    Acceso institucional para administrar ciclos, formularios, documentos y revisión por perfil.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {features.map((feature) => (
                  <div
                    key={feature}
                    className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-700 shadow-sm"
                  >
                    {feature}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Colegio</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Fundación</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Administración</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">PDF y auditoría</span>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
              <div className="fni-logo-shell fni-logo-shell-login w-full">
                <img src={belenLogo} alt="Belen Educa" className="h-16 w-auto max-w-[360px] object-contain" />
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Acceso de usuarios</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Ingresar a la plataforma</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Usa tu correo institucional para entrar según tu perfil y continuar el trabajo del ciclo.
                </p>
              </div>

              <form className="mt-6 grid gap-3" onSubmit={(event) => void onSubmit(event)}>
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-200"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />

                <label className="text-sm font-semibold text-slate-700">Contraseña</label>
                <input
                  type="password"
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-200"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Ingresando..." : "Ingresar"}
                </button>

                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                  <b>Credenciales de desarrollo:</b>
                  <div>- admin@demo.cl / demo</div>
                  <div>- fundacion.01@demo.cl a fundacion.06@demo.cl / demo</div>
                  <div>- cc@demo.cl, cace@demo.cl, camv@demo.cl, ccoc@demo.cl, cjff@demo.cl / demo</div>
                  <div>- cjlu@demo.cl, cjmc@demo.cl, cls@demo.cl, cpd@demo.cl / demo</div>
                  <div>- crsh@demo.cl, csah@demo.cl, csdm@demo.cl, csfa@demo.cl / demo</div>
                </div>

                <div className="text-xs leading-5 text-slate-500">
                  El acceso se valida contra el servidor y tus datos se cargan según tu perfil.
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

