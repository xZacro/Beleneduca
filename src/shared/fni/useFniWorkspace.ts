import { useEffect, useRef, useState } from "react";

import { getFniRepository } from "./repository";
import {
  defaultSubmissionRecord,
  type FniWorkspaceSnapshot,
  type IndicatorResponse,
  type ReviewMap,
  type SchoolCycleRef,
  type SubmissionRecord,
} from "./types";

type Updater<T> = T | ((current: T) => T);

function resolveUpdater<T>(current: T, updater: Updater<T>) {
  return typeof updater === "function" ? (updater as (value: T) => T)(current) : updater;
}

function emptyWorkspace(): FniWorkspaceSnapshot {
  return {
    responses: {},
    reviews: {},
    submission: defaultSubmissionRecord(),
  };
}

export function useFniWorkspace(ref: SchoolCycleRef | null) {
  const repository = getFniRepository();
  const schoolId = ref?.schoolId ?? null;
  const cycleId = ref?.cycleId ?? null;
  const [workspace, setWorkspace] = useState<FniWorkspaceSnapshot | null>(null);
  const workspaceRef = useRef<FniWorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(ref));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !cycleId) {
      workspaceRef.current = null;
      setWorkspace(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Cuando cambia el contexto, recargamos desde la fuente activa y reseteamos cache local.
    const activeRef = { schoolId, cycleId };
    let cancelled = false;

    async function loadWorkspace() {
      setLoading(true);
      setError(null);
      workspaceRef.current = null;
      setWorkspace(null);

      try {
        const nextWorkspace = await repository.readWorkspace(activeRef);
        if (!cancelled) {
          workspaceRef.current = nextWorkspace;
          setWorkspace(nextWorkspace);
        }
      } catch (loadError) {
        if (!cancelled) {
          workspaceRef.current = null;
          setWorkspace(null);
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el workspace.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [cycleId, repository, schoolId]);

  const persistResponses = async (updater: Updater<Record<string, IndicatorResponse>>) => {
    if (!ref) return;

    // Escritura optimista: la UI se actualiza primero y luego sincronizamos con la API.
    const currentWorkspace = workspaceRef.current ?? emptyWorkspace();
    const previousWorkspace = currentWorkspace;
    const nextResponses = resolveUpdater(currentWorkspace.responses, updater);
    const nextWorkspace = {
      ...currentWorkspace,
      responses: nextResponses,
    };

    workspaceRef.current = nextWorkspace;
    setWorkspace(nextWorkspace);
    setError(null);

    try {
      await repository.saveResponses(ref, nextResponses);
    } catch (persistError) {
      workspaceRef.current = previousWorkspace;
      setWorkspace(previousWorkspace);
      setError(persistError instanceof Error ? persistError.message : "No se pudo guardar respuestas.");
    }
  };

  const persistReviews = async (updater: Updater<ReviewMap>) => {
    if (!ref) return;

    const currentWorkspace = workspaceRef.current ?? emptyWorkspace();
    const previousWorkspace = currentWorkspace;
    const nextReviews = resolveUpdater(currentWorkspace.reviews, updater);
    const nextWorkspace = {
      ...currentWorkspace,
      reviews: nextReviews,
    };

    workspaceRef.current = nextWorkspace;
    setWorkspace(nextWorkspace);
    setError(null);

    try {
      await repository.saveReviews(ref, nextReviews);
    } catch (persistError) {
      workspaceRef.current = previousWorkspace;
      setWorkspace(previousWorkspace);
      setError(persistError instanceof Error ? persistError.message : "No se pudo guardar revisión.");
    }
  };

  const persistSubmission = async (updater: Updater<SubmissionRecord>) => {
    if (!ref) return;

    const currentWorkspace = workspaceRef.current ?? emptyWorkspace();
    const previousWorkspace = currentWorkspace;
    const nextSubmission = resolveUpdater(currentWorkspace.submission, updater);
    const nextWorkspace = {
      ...currentWorkspace,
      submission: nextSubmission,
    };

    workspaceRef.current = nextWorkspace;
    setWorkspace(nextWorkspace);
    setError(null);

    try {
      await repository.saveSubmission(ref, nextSubmission);
    } catch (persistError) {
      workspaceRef.current = previousWorkspace;
      setWorkspace(previousWorkspace);
      setError(persistError instanceof Error ? persistError.message : "No se pudo guardar el envío.");
    }
  };

  return {
    repository,
    workspace,
    loading,
    error,
    setError,
    reloadSource: repository.source,
    setResponses: persistResponses,
    setReviews: persistReviews,
    setSubmission: persistSubmission,
  };
}
