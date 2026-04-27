import { useEffect, useMemo } from "react";
import { matchPath, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

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

const PAGE_TITLES: Array<{ path: string; title: string }> = [
  { path: ROUTES.foundation.dashboard, title: "FNI | Panel del ciclo" },
  { path: ROUTES.foundation.schools, title: "FNI | Colegios" },
  { path: ROUTES.foundation.schoolForm, title: "FNI | Formulario del colegio" },
  { path: ROUTES.foundation.schoolDocuments, title: "FNI | Documentos del colegio" },
  { path: ROUTES.foundation.schoolReview, title: "FNI | Revisión del colegio" },
  { path: ROUTES.foundation.catalog, title: "FNI | Catálogo FNI" },
  { path: ROUTES.foundation.catalogIndicator, title: "FNI | Indicador FNI" },
  { path: ROUTES.school.dashboard, title: "FNI | Dashboard colegio" },
  { path: ROUTES.school.evaluation, title: "FNI | Evaluación FNI" },
  { path: ROUTES.school.documents, title: "FNI | Documentos del colegio" },
  { path: ROUTES.account.security, title: "FNI | Seguridad" },
  { path: ROUTES.admin.root, title: "FNI | Panel administrativo" },
  { path: ROUTES.admin.users, title: "FNI | Usuarios" },
  { path: ROUTES.admin.sessions, title: "FNI | Accesos" },
  { path: ROUTES.admin.audit, title: "FNI | Actividad" },
];

function resolvePageTitle(pathname: string) {
  for (const page of PAGE_TITLES) {
    if (matchPath({ path: page.path, end: true }, pathname)) {
      return page.title;
    }
  }

  return "FNI | Fundación Belén Educa";
}

export default function AppLayout() {
  useHeartbeat();

  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, setUser } = useResolvedAuthUser({ validateOnMount: true });

  useEffect(() => {
    document.title = resolvePageTitle(location.pathname);
  }, [location.pathname]);

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
        label: "FNI",
        items: [
          { to: ROUTES.foundation.dashboard, label: isAdmin ? "Panel del ciclo" : "Dashboard" },
          { to: ROUTES.foundation.schools, label: "Colegios" },
          { to: ROUTES.foundation.catalog, label: "Catálogo FNI" },
        ],
      });
    }

    if (isSchool) {
      sections.push({
        key: "school",
        label: "Mi colegio",
        items: [
          { to: ROUTES.school.dashboard, label: "Dashboard" },
          { to: ROUTES.school.evaluation, label: "Evaluación FNI" },
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
        label: "Administración",
        items: [
          { to: ROUTES.admin.root, label: "Panel administrativo" },
          { to: ROUTES.admin.users, label: "Usuarios" },
          { to: ROUTES.admin.sessions, label: "Accesos" },
          { to: ROUTES.admin.audit, label: "Actividad" },
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
          {"Cargando tu acceso..."}
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
              <div className="text-xl font-bold tracking-tight text-slate-900">FNI</div>
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
                        end
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

        <section
          key={location.pathname}
          className="fni-route-panel-enter min-h-[560px] min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <Outlet />
        </section>
      </main>

      <footer className="w-full border-t border-slate-200 bg-white px-4 py-6">
        <div className="mx-auto w-full max-w-[1600px] text-center">
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
