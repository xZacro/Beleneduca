#!/usr/bin/env bash
set -euo pipefail

# Load the whole function before fetching changes that may update this script.
main() {
  local project_dir branch target_sha
  project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
  cd -- "$project_dir"

  if [[ $# -ne 0 ]]; then
    printf 'Uso: bash scripts/ops/actualizar-web.sh\n' >&2
    return 1
  fi

  command -v git >/dev/null
  command -v docker >/dev/null
  docker compose version >/dev/null

  branch="$(git branch --show-current)"
  if [[ "$branch" != main ]]; then
    printf 'La instalacion debe estar en la rama main. Rama actual: %s\n' "$branch" >&2
    return 1
  fi

  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    printf 'Hay cambios locales pendientes. Revisalos antes de actualizar.\n' >&2
    return 1
  fi

  local -a compose=(docker compose -f docker-compose.prod.yml)
  "${compose[@]}" config --quiet
  if [[ -z "$("${compose[@]}" ps --status running -q app)" ||
        -z "$("${compose[@]}" ps --status running -q postgres)" ]]; then
    printf 'Este comando requiere una instalacion con app y postgres en ejecucion.\n' >&2
    return 1
  fi

  printf 'Descargando la ultima version de FNI...\n'
  git fetch origin main
  target_sha="$(git rev-parse --verify FETCH_HEAD)"

  if [[ -n "$(git diff --name-only HEAD "$target_sha" -- prisma/schema.prisma prisma/migrations)" ]]; then
    printf 'Esta version cambia el esquema de datos. Revisa docs/deployment.md antes de desplegar.\n' >&2
    return 1
  fi

  git merge --ff-only "$target_sha"

  printf 'Preparando la nueva version; la web actual sigue funcionando...\n'
  "${compose[@]}" build app
  "${compose[@]}" up -d --no-deps app

  printf 'Comprobando que FNI este disponible...\n'
  if ! "${compose[@]}" exec -T app node --input-type=module -e '
    const url = `http://127.0.0.1:${process.env.FNI_API_PORT || 4100}/api/ready`;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (response.ok) process.exit(0);
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    process.exit(1);
  '; then
    printf 'La comprobacion final fallo. Revisa: docker compose -f docker-compose.prod.yml logs --tail 80 app\n' >&2
    return 1
  fi

  printf 'FNI actualizada correctamente a %s.\n' "$target_sha"
}

main "$@"
