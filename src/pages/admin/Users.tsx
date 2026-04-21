import { useEffect, useMemo, useState } from "react";

import type {
  AdminUserCreateRequest,
  AdminUserDto,
  AdminUserStatus,
  SchoolSummaryDto,
} from "../../shared/admin/apiContracts";
import {
  createUser,
  listSchools,
  listUsers,
  resetUserPassword,
  updateUser,
} from "../../shared/admin/client";
import { getUser, type Role } from "../../shared/auth";
import { normalizeSchoolCode, normalizeSchoolName } from "../../shared/fni/schools";

// Gestion de usuarios admin: alta, edicion, roles, estado y reseteo de contrasena.
type UserFormState = {
  name: string;
  email: string;
  roles: Role[];
  schoolId: string;
  status: AdminUserStatus;
  password: string;
};

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "ADMIN", label: "Admin" },
  { value: "FUNDACION", label: "Fundación" },
  { value: "COLEGIO", label: "Colegio" },
];

const STATUS_OPTIONS: Array<{ value: AdminUserStatus; label: string }> = [
  { value: "ACTIVE", label: "Activo" },
  { value: "INVITED", label: "Invitado" },
  { value: "DISABLED", label: "Deshabilitado" },
];

function emptyForm(): UserFormState {
  return {
    name: "",
    email: "",
    roles: ["FUNDACION"],
    schoolId: "",
    status: "ACTIVE",
    password: "demo",
  };
}

function validateForm(form: UserFormState, mode: "create" | "edit") {
  if (!form.name.trim()) {
    return "Debes ingresar un nombre.";
  }

  if (!form.email.trim()) {
    return "Debes ingresar un email.";
  }

  if (!form.roles.length) {
    return "Debes seleccionar al menos un rol.";
  }

  if (form.roles.includes("COLEGIO") && !form.schoolId.trim()) {
    return "Selecciona un colegio para usuarios con rol Colegio.";
  }

  if (mode === "create" && form.password.trim().length < 4) {
    return "La contraseña inicial debe tener al menos 4 caracteres.";
  }

  return null;
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

function roleLabel(role: Role) {
  if (role === "ADMIN") return "Admin";
  if (role === "FUNDACION") return "Fundación";
  return "Colegio";
}

function statusLabel(status: AdminUserStatus) {
  if (status === "ACTIVE") return "Activo";
  if (status === "INVITED") return "Invitado";
  return "Deshabilitado";
}

function statusTone(status: AdminUserStatus) {
  if (status === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "INVITED") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function roleTone(role: Role) {
  if (role === "ADMIN") return "border-slate-200 bg-slate-900 text-white";
  if (role === "FUNDACION") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function buildFormFromUser(user: AdminUserDto): UserFormState {
  return {
    name: user.name,
    email: user.email,
    roles: [...user.roles],
    schoolId: user.schoolId ?? "",
    status: user.status,
    password: "demo",
  };
}

function sortUsers(users: AdminUserDto[]) {
  return [...users].sort((left, right) => left.email.localeCompare(right.email));
}

export default function AdminUsers() {
  const currentUser = getUser();
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [schools, setSchools] = useState<SchoolSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AdminUserStatus>("ALL");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<UserFormState>(() => emptyForm());
  const [resetPasswordValue, setResetPasswordValue] = useState("demo");

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  const load = async (options?: { preserveSelection?: boolean; selectionId?: string | null }) => {
    setLoading(true);
    setError(null);

    try {
      // Traemos usuarios y colegios en paralelo porque el formulario depende de ambos conjuntos.
      const [nextUsers, nextSchools] = await Promise.all([listUsers(), listSchools()]);
      const sortedUsers = sortUsers(nextUsers);
      const selectionId = options?.selectionId ?? selectedUserId;

      setUsers(sortedUsers);
      setSchools(nextSchools);

      if (options?.preserveSelection && selectionId) {
        const stillSelected = sortedUsers.find((user) => user.id === selectionId);
        if (stillSelected) {
          setSelectedUserId(stillSelected.id);
          setMode("edit");
          setForm(buildFormFromUser(stillSelected));
          return;
        }
      }

      setSelectedUserId(null);
      setMode("create");
      setForm(emptyForm());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesTerm =
        !term ||
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        (user.schoolName ?? "").toLowerCase().includes(term);
      const matchesRole = roleFilter === "ALL" || user.roles.includes(roleFilter);
      const matchesStatus = statusFilter === "ALL" || user.status === statusFilter;

      return matchesTerm && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const kpis = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.status === "ACTIVE").length;
    const invited = users.filter((user) => user.status === "INVITED").length;
    const disabled = users.filter((user) => user.status === "DISABLED").length;

    return { total, active, invited, disabled };
  }, [users]);

  const schoolOptions = useMemo(
    () => [...schools].sort((left, right) => left.name.localeCompare(right.name)),
    [schools]
  );

  const requiresSchool = form.roles.includes("COLEGIO");

  const updateForm = (patch: Partial<UserFormState>) => {
    setFormError(null);
    setForm((current) => {
      const next = { ...current, ...patch };
      // Un usuario deja de requerir colegio en cuanto pierde el rol COLEGIO.
      if (!next.roles.includes("COLEGIO")) {
        next.schoolId = "";
      }
      return next;
    });
  };

  const toggleRole = (role: Role) => {
    setFormError(null);
    setForm((current) => {
      const roles = current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role];

      return {
        ...current,
        roles,
        schoolId: roles.includes("COLEGIO") ? current.schoolId : "",
      };
    });
  };

  const beginCreate = () => {
    setMode("create");
    setSelectedUserId(null);
    setForm(emptyForm());
    setResetPasswordValue("demo");
    setFormError(null);
    setNotice(null);
  };

  const beginEdit = (user: AdminUserDto) => {
    setMode("edit");
    setSelectedUserId(user.id);
    setForm(buildFormFromUser(user));
    setResetPasswordValue("demo");
    setFormError(null);
    setNotice(null);
  };

  const onSubmit = async () => {
    const validationError = validateForm(form, mode);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      const payloadBase = {
        name: form.name.trim(),
        email: form.email.trim(),
        roles: form.roles,
        schoolId: requiresSchool ? form.schoolId || null : null,
        status: form.status,
      };

      if (mode === "create") {
        const payload: AdminUserCreateRequest = {
          ...payloadBase,
          password: form.password,
        };

        const created = await createUser(payload);
        setSelectedUserId(created.id);
        setMode("edit");
        setResetPasswordValue("demo");
        setNotice("Usuario creado correctamente.");
        await load({ preserveSelection: true, selectionId: created.id });
      } else if (selectedUserId) {
        await updateUser(selectedUserId, payloadBase);
        setNotice("Usuario actualizado correctamente.");
        await load({ preserveSelection: true, selectionId: selectedUserId });
      }
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "No se pudo guardar el usuario.");
    } finally {
      setSaving(false);
    }
  };

  const onResetPassword = async () => {
    if (!selectedUserId) return;

    if (resetPasswordValue.trim().length < 4) {
      setFormError("La nueva contraseña debe tener al menos 4 caracteres.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      await resetUserPassword(selectedUserId, { password: resetPasswordValue });
      setNotice("Contraseña restablecida correctamente.");
      await load({ preserveSelection: true, selectionId: selectedUserId });
    } catch (resetError) {
      setFormError(
        resetError instanceof Error ? resetError.message : "No se pudo restablecer la contraseña."
      );
    } finally {
      setSaving(false);
    }
  };

  const onQuickStatusChange = async (
    user: AdminUserDto,
    nextStatus: AdminUserStatus
  ) => {
    // Este cambio es intencionalmente rapido: activa o desactiva sin abrir el formulario completo.
    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      await updateUser(user.id, {
        name: user.name,
        email: user.email,
        roles: user.roles,
        schoolId: user.schoolId,
        status: nextStatus,
      });
      setNotice(
        nextStatus === "DISABLED"
          ? "Usuario deshabilitado correctamente."
          : "Usuario reactivado correctamente."
      );
      await load({ preserveSelection: true, selectionId: selectedUserId });
    } catch (statusError) {
      setFormError(
        statusError instanceof Error ? statusError.message : "No se pudo actualizar el estado."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fni-page-shell">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="fni-page-title">Usuarios</h1>
          <p className="fni-page-subtitle">
            Gestión de cuentas, roles y contraseñas para admin, fundación y colegio.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={beginCreate} className="fni-toolbar-button">
            Nuevo usuario
          </button>
          <button
            type="button"
            onClick={() => void load({ preserveSelection: true, selectionId: selectedUserId })}
            className="fni-toolbar-button"
          >
            Refrescar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="fni-metric-card border-slate-200 bg-slate-50">
          <div className="text-xs font-semibold tracking-wide text-slate-500">Usuarios</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{kpis.total}</div>
        </div>
        <div className="fni-metric-card border-emerald-200 bg-emerald-50">
          <div className="text-xs font-semibold tracking-wide text-emerald-700">Activos</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-900">{kpis.active}</div>
        </div>
        <div className="fni-metric-card border-blue-200 bg-blue-50">
          <div className="text-xs font-semibold tracking-wide text-blue-700">Invitados</div>
          <div className="mt-2 text-3xl font-semibold text-blue-900">{kpis.invited}</div>
        </div>
        <div className="fni-metric-card border-rose-200 bg-rose-50">
          <div className="text-xs font-semibold tracking-wide text-rose-700">Deshabilitados</div>
          <div className="mt-2 text-3xl font-semibold text-rose-900">{kpis.disabled}</div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
        <div className="space-y-4">
          <div className="fni-data-panel p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
              <div className="md:col-span-6">
                <label className="fni-field-label">Buscar</label>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, email o colegio"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Mostrando {filteredUsers.length} de {users.length} usuarios.
                </p>
              </div>

              <div className="md:col-span-3">
                <label className="fni-field-label">Rol</label>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as "ALL" | Role)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
                >
                  <option value="ALL">Todos</option>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="fni-field-label">Estado</label>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "ALL" | AdminUserStatus)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
                >
                  <option value="ALL">Todos</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="fni-data-table-shell">
            <div className="fni-data-table-scroll">
              <table className="fni-data-table">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                    <th className="px-4 py-3 text-left font-semibold">Roles</th>
                    <th className="px-4 py-3 text-left font-semibold">Colegio</th>
                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                    <th className="px-4 py-3 text-left font-semibold">Actualizado</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-600">
                        Cargando usuarios...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-600">
                        No hay usuarios para los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => beginEdit(user)}
                        className={`cursor-pointer ${
                          user.id === selectedUserId ? "bg-slate-50/70" : "hover:bg-slate-50/60"
                        }`}
                      >
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900">{user.name}</div>
                          <div className="text-sm text-slate-600">{user.email}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {user.roles.map((role) => (
                              <span
                                key={`${user.id}-${role}`}
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${roleTone(
                                  role
                                )}`}
                              >
                                {roleLabel(role)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{user.schoolName ?? "-"}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(
                              user.status
                            )}`}
                          >
                            {statusLabel(user.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatDate(user.updatedAt)}</td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                beginEdit(user);
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>

                            {currentUser?.email === user.email ? (
                              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                                Tu cuenta
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onQuickStatusChange(
                                    user,
                                    user.status === "DISABLED" ? "ACTIVE" : "DISABLED"
                                  );
                                }}
                                className={`rounded-lg border px-3 py-2 text-sm ${
                                  saving
                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                                    : user.status === "DISABLED"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                }`}
                              >
                                {user.status === "DISABLED" ? "Reactivar" : "Desactivar"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {mode === "create" ? "Crear usuario" : "Editar usuario"}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {mode === "create"
                    ? "Define rol, estado y acceso inicial."
                    : `Editando ${selectedUser?.email ?? "usuario"}.`}
                </p>
              </div>

              {mode === "edit" && (
                <button type="button" onClick={beginCreate} className="fni-toolbar-button">
                  Nuevo
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div>
                <label className="fni-field-label">Nombre</label>
                <input
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Nombre visible"
                />
              </div>

              <div>
                <label className="fni-field-label">Email</label>
                <input
                  value={form.email}
                  onChange={(event) => updateForm({ email: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="usuario@beleneduca.cl"
                />
              </div>

              <div>
                <label className="fni-field-label">Roles</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((role) => {
                    const active = form.roles.includes(role.value);

                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => toggleRole(role.value)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {role.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Si marcas Colegio, el usuario debe quedar asociado a un colegio.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="fni-field-label">Estado</label>
                  <select
                    value={form.status}
                    onChange={(event) => updateForm({ status: event.target.value as AdminUserStatus })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="fni-field-label">Colegio</label>
                  <select
                    value={form.schoolId}
                    disabled={!requiresSchool}
                    onChange={(event) => updateForm({ schoolId: event.target.value })}
                    className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                      requiresSchool ? "bg-white" : "cursor-not-allowed bg-slate-50 text-slate-500"
                    }`}
                  >
                    <option value="">{requiresSchool ? "Selecciona colegio" : "No aplica"}</option>
                    {schoolOptions.map((school) => (
                      <option key={school.id} value={school.id}>
                        {normalizeSchoolCode(school.code)} - {normalizeSchoolName(normalizeSchoolCode(school.code), school.name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {mode === "create" && (
                <div>
                  <label className="fni-field-label">Contraseña inicial</label>
                  <input
                    value={form.password}
                    onChange={(event) => updateForm({ password: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Mínimo 4 caracteres"
                  />
                </div>
              )}

              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {formError}
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
                {saving ? "Guardando..." : mode === "create" ? "Crear usuario" : "Guardar cambios"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Restablecer contraseña</div>
          <p className="mt-1 text-sm text-slate-600">
              Cierra sesiones activas y asigna una nueva contraseña al usuario seleccionado.
          </p>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {selectedUser ? (
                <>
                  <div className="font-medium text-slate-900">{selectedUser.name}</div>
                  <div>{selectedUser.email}</div>
                </>
              ) : (
                "Selecciona un usuario de la tabla para habilitar este bloque."
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="fni-field-label">Nueva contraseña</label>
                <input
                  value={resetPasswordValue}
                  onChange={(event) => {
                    setFormError(null);
                    setResetPasswordValue(event.target.value);
                  }}
                  disabled={!selectedUserId}
                  className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${
                    selectedUserId ? "bg-white" : "cursor-not-allowed bg-slate-50 text-slate-500"
                  }`}
                  placeholder="Mínimo 4 caracteres"
                />
              </div>

              <button
                type="button"
                onClick={() => void onResetPassword()}
                disabled={!selectedUserId || saving}
                className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  !selectedUserId || saving
                    ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500"
                    : "border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                }`}
              >
                {selectedUserId ? "Restablecer contraseña" : "Selecciona un usuario"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
