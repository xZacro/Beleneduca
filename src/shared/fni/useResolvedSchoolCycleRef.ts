import { useEffect, useState } from "react";

import { getFniRepository } from "./repository";
import type { SchoolCycleRef } from "./types";

// Resuelve schoolId + cycleId cuando la vista recibe contexto incompleto o necesita fallback.
type UseResolvedSchoolCycleRefOptions = {
  schoolId?: string | null;
  cycleId?: string | null;
  allowStoredContextFallback?: boolean;
};

function shouldResolveContext({
  schoolId,
  cycleId,
  allowStoredContextFallback,
}: UseResolvedSchoolCycleRefOptions) {
  if (schoolId && cycleId) return false;
  if (schoolId) return true;
  return Boolean(allowStoredContextFallback);
}

export function useResolvedSchoolCycleRef({
  schoolId,
  cycleId,
  allowStoredContextFallback = false,
}: UseResolvedSchoolCycleRefOptions) {
  const repository = getFniRepository();
  const [ref, setRef] = useState<SchoolCycleRef | null>(() =>
    schoolId && cycleId ? { schoolId, cycleId } : null
  );
  const [loading, setLoading] = useState(
    shouldResolveContext({ schoolId, cycleId, allowStoredContextFallback })
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (schoolId && cycleId) {
      // Cuando el contexto ya viene completo, no hacemos resolucion adicional.
      setRef({ schoolId, cycleId });
      setLoading(false);
      setError(null);
      return;
    }

    if (!schoolId && !allowStoredContextFallback) {
      setRef(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function resolveRef() {
      setLoading(true);
      setError(null);

      try {
        if (schoolId) {
          // Si solo llega schoolId, inferimos el ciclo unico disponible para ese colegio.
          const inferredCycleId = await repository.inferSingleCycleIdForSchool(schoolId);
          if (!cancelled) {
            setRef(inferredCycleId ? { schoolId, cycleId: inferredCycleId } : null);
          }
          return;
        }

        // Si no llega contexto, intentamos recuperar un unico workspace almacenado.
        const inferredRef = await repository.inferSingleStoredContext();
        if (!cancelled) {
          setRef(inferredRef);
        }
      } catch (resolveError) {
        if (!cancelled) {
          setRef(null);
          setError(
            resolveError instanceof Error
              ? resolveError.message
              : "No se pudo resolver el contexto del workspace."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void resolveRef();

    return () => {
      cancelled = true;
    };
  }, [allowStoredContextFallback, cycleId, repository, schoolId]);

  return {
    repository,
    ref,
    loading,
    error,
  };
}
