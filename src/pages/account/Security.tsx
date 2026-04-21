import { useState } from "react";

import { changeOwnPassword, getUser, roleLabel } from "../../shared/auth";
import { useSchoolDisplayName } from "../../shared/useSchoolDirectory";

export default function AccountSecurity() {
  const user = getUser();
  const { schoolLabel } = useSchoolDisplayName(user?.schoolId ?? null);
  const accountName = user?.roles.includes("COLEGIO") ? schoolLabel : user?.name ?? "-";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setNotice(null);

    if (!currentPassword.trim()) {
      setError("Debes ingresar tu contraseña actual.");
      return;
    }

    if (newPassword.trim().length < 4) {
      setError("La nueva contraseña debe tener al menos 4 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("La nueva contraseña debe ser distinta a la actual.");
      return;
    }

    setSaving(true);

    try {
      await changeOwnPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Contraseña actualizada correctamente. Las demás sesiones activas se cerraron por seguridad.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar la contraseña."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="fni-page-title">Seguridad</h1>
          <p className="fni-page-subtitle">
            Administra tu acceso y cambia tu contraseña cuando lo necesites.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.7fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Cambiar contraseña</div>
          <p className="mt-1 text-sm text-slate-600">
            Tu sesión actual seguirá activa. Las demás sesiones abiertas se cerrarán por seguridad.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <div>
              <label className="fni-field-label">Contraseña actual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  setError(null);
                  setNotice(null);
                  setCurrentPassword(event.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Tu contraseña actual"
              />
            </div>

            <div>
              <label className="fni-field-label">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setError(null);
                  setNotice(null);
                  setNewPassword(event.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Mínimo 4 caracteres"
              />
            </div>

            <div>
              <label className="fni-field-label">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setError(null);
                  setNotice(null);
                  setConfirmPassword(event.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Repite la nueva contraseña"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {error}
              </div>
            )}

            {notice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {notice}
              </div>
            )}

            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={saving}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                saving
                  ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {saving ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Mi cuenta</div>
          <p className="mt-1 text-sm text-slate-600">
            Resumen rápido de tu sesión y del perfil activo.
          </p>

          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold tracking-wide text-slate-500">Nombre</div>
              <div className="mt-1 font-medium text-slate-900">{accountName}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold tracking-wide text-slate-500">Email</div>
              <div className="mt-1 font-medium text-slate-900">{user?.email ?? "-"}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold tracking-wide text-slate-500">Rol activo</div>
              <div className="mt-1 font-medium text-slate-900">{roleLabel(user)}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold tracking-wide text-slate-500">Colegio asociado</div>
              <div className="mt-1 font-medium text-slate-900">{schoolLabel}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
