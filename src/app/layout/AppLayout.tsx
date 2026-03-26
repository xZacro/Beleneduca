import { useEffect, useMemo } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import belenLogo from "../../assets/belen-logo.png";
import { hasRole, logout, roleLabel } from "../../shared/auth";
import { useResolvedAuthUser } from "../../shared/useResolvedAuthUser";
import { useHeartbeat } from "../../shared/useHeartbeat";
import { ROUTES } from "../routes/routeConfig";

// Shell principal de la app: header, menu lateral, logout y area de contenido.
function navItemClass(active: boolean) {
  return active
    ? "bg-slate-900 text-white shadow-sm"
    : "text-slate-700 hover:bg-slate-100";
}

type NavItem = {
  to: string;
  label: string;
};

type NavSection = {
  key: string;
  label: string;
  items: NavItem[];
};

export default function AppLayout() {
  useHeartbeat();

  const navigate = useNavigate();
  const { user, loading, setUser } = useResolvedAuthUser({ validateOnMount: true });

  useEffect(() => {
    if (!loading && !user) {
      navigate(ROUTES.login, { replace: true });
    }
  }, [loading, navigate, user]);

  const navSections = useMemo<NavSection[]>(() => {
    if (!user) return [];

    const isAdmin = hasRole(user, "ADMIN");
    const isFoundation = hasRole(user, "FUNDACION") || isAdmin;
    const isSchool = hasRole(user, "COLEGIO");

    // El menu se arma por rol para que el layout no conozca reglas de autorizacion.
    const sections: NavSection[] = [];

    if (isFoundation) {
      sections.push({
        key: "foundation",
        label: "Gestor Documental",
        items: [
          { to: ROUTES.foundation.dashboard, label: isAdmin ? "Operacion ciclo" : "Dashboard" },
          { to: ROUTES.foundation.schools, label: "Colegios" },
          { to: ROUTES.foundation.catalog, label: "Cat\u00E1logo FNI" },
        ],
      });
    }

    if (isSchool) {
      sections.push({
        key: "school",
        label: "Mi colegio",
        items: [
          { to: ROUTES.school.dashboard, label: "Dashboard" },
          { to: ROUTES.school.evaluation, label: "Evaluaci\u00F3n FNI" },
          { to: ROUTES.school.documents, label: "Documentos" },
        ],
      });
    }

    sections.push({
      key: "account",
      label: "Cuenta",
      items: [{ to: ROUTES.account.security, label: "Seguridad" }],
    });

    if (isAdmin) {
      sections.push({
        key: "admin",
        label: "Administraci\u00F3n",
        items: [
          { to: ROUTES.admin.root, label: "Centro de control" },
          { to: ROUTES.admin.users, label: "Usuarios" },
          { to: ROUTES.admin.sessions, label: "Sesiones" },
          { to: ROUTES.admin.audit, label: "Auditor\u00EDa" },
        ],
      });
    }

    return sections;
  }, [user]);

  const onLogout = async () => {
    await logout();
    setUser(null);
    navigate(ROUTES.login, { replace: true });
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          {"Validando sesi\u00F3n..."}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50">
      <div className="fni-brand-ribbon fni-brand-ribbon-thin" />

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="fni-logo-shell fni-logo-shell-header">
              <img src={belenLogo} alt="Belen Educa" className="h-12 w-auto max-w-[300px] object-contain md:h-14" />
            </div>

            <div className="leading-tight">
              <div className="text-xl font-bold tracking-tight text-slate-900">Gestor Documental</div>
              <div className="text-base font-semibold text-slate-600">Belen Educa</div>
            </div>

            <span className="ml-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
              Rol: {roleLabel(user)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void onLogout();
              }}
              className="fni-toolbar-button active:translate-y-[1px]"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="relative z-10 h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-[11px] font-semibold tracking-widest text-slate-500">MENU</div>

          <nav className="space-y-4">
            {navSections.map((section) => {
              return (
                <div key={section.key} className="space-y-2">
                  <div className="px-2 text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
                    {section.label}
                  </div>

                  <div className="grid gap-2">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `block rounded-xl border border-transparent px-3 py-2 text-sm font-medium ${navItemClass(
                            isActive
                          )}`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        <section className="min-h-[560px] min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Outlet />
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1600px] px-4 pb-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
          <div className="text-sm font-semibold tracking-[0.18em] text-slate-900 uppercase">
            Fundación Belén Educa
          </div>
          <div className="mt-2 text-sm text-slate-600">
            © 2026 Fundación Belén Educa. Todos los derechos reservados.
          </div>
          <div className="mt-1 text-sm text-slate-500">Desarrollado por Lunaria AI</div>
        </div>
      </footer>

      <div>
        <div className="fni-brand-ribbon fni-brand-ribbon-thin" />
      </div>
    </div>
  );
}
