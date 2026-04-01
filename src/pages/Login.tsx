import { useState } from "react";
import { useNavigate } from "react-router-dom";

import belenLogo from "../assets/belen-logo.png";
import { getHomeForUser } from "../app/routes/home";
import { login } from "../shared/auth";

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
        setError("Credenciales invÃ¡lidas o sesiÃ³n no disponible.");
        return;
      }

      navigate(getHomeForUser(user), { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo iniciar sesiÃ³n.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <div className="fni-brand-ribbon fni-brand-ribbon-thin" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="fni-logo-shell fni-logo-shell-header">
            <img src={belenLogo} alt="Belen Educa" className="h-12 w-auto max-w-[300px] object-contain md:h-14" />
          </div>

          <div className="leading-tight">
            <div className="text-base font-semibold text-slate-900">Gestor Documental</div>
            <div className="text-sm text-slate-500">Acceso de usuarios</div>
          </div>
        </div>
      </div>

      <div className="grid flex-1 place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="fni-logo-shell fni-logo-shell-login w-full">
              <img src={belenLogo} alt="Belen Educa" className="h-14 w-auto max-w-[360px] object-contain" />
            </div>
          </div>

          <form className="mt-5 grid gap-3" onSubmit={(event) => void onSubmit(event)}>
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-4 focus:ring-slate-200"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label className="text-sm font-semibold text-slate-700">ContraseÃ±a</label>
            <input
              type="password"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-4 focus:ring-slate-200"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-extrabold text-white hover:bg-slate-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Ingresando..." : "Ingresar"}
            </button>

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
              <b>Credenciales de desarrollo:</b>
              <div>- admin@demo.cl / demo</div>
              <div>- fundacion.01@demo.cl a fundacion.06@demo.cl / demo</div>
              <div>- cace@demo.cl, camv@demo.cl, ccoc@demo.cl, cjff@demo.cl / demo</div>
              <div>- cjlu@demo.cl, cjmc@demo.cl, clsm@demo.cl, cpdm@demo.cl / demo</div>
              <div>- crsh@demo.cl, csah@demo.cl, csdm@demo.cl, csfa@demo.cl / demo</div>
            </div>

            <div className="text-xs text-slate-500">
              El acceso se valida contra el servidor y tus datos se cargan según tu perfil.
            </div>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="fni-brand-ribbon fni-brand-ribbon-thin rounded-full" />
      </div>
    </div>
  );
}

