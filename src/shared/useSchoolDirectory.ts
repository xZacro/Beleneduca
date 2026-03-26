import { useEffect, useMemo, useState } from "react";

import type { SchoolSummaryDto } from "./admin/apiContracts";
import { listSchools } from "./admin/client";
import { getFniRepository } from "./fni/repository";

export type SchoolDirectoryEntry = Pick<
  SchoolSummaryDto,
  "id" | "code" | "name" | "managerName" | "managerEmail"
>;

let cachedSchoolDirectory: SchoolDirectoryEntry[] | null = null;
let pendingSchoolDirectoryLoad: Promise<SchoolDirectoryEntry[]> | null = null;

function mergeSchoolDirectoryEntries(entries: SchoolDirectoryEntry[]) {
  const currentEntries = cachedSchoolDirectory ?? [];
  const entriesById = new Map<string, SchoolDirectoryEntry>();

  for (const entry of currentEntries) {
    entriesById.set(entry.id, entry);
  }

  for (const entry of entries) {
    const currentEntry = entriesById.get(entry.id);

    entriesById.set(entry.id, {
      ...currentEntry,
      ...entry,
      managerName: entry.managerName ?? currentEntry?.managerName ?? null,
      managerEmail: entry.managerEmail ?? currentEntry?.managerEmail ?? null,
    });
  }

  cachedSchoolDirectory = Array.from(entriesById.values());
  return cachedSchoolDirectory;
}

async function loadSchoolDirectory() {
  if (cachedSchoolDirectory) {
    return cachedSchoolDirectory;
  }

  if (!pendingSchoolDirectoryLoad) {
    pendingSchoolDirectoryLoad = listSchools()
      .then((schools) => {
        return mergeSchoolDirectoryEntries(schools);
      })
      .finally(() => {
        pendingSchoolDirectoryLoad = null;
      });
  }

  return pendingSchoolDirectoryLoad;
}

export function formatSchoolDisplayName(school: Pick<SchoolDirectoryEntry, "code" | "name">) {
  return `${school.code} - ${school.name}`;
}

export function resolveSchoolDirectoryEntry(
  schoolId: string | null | undefined,
  schools: SchoolDirectoryEntry[]
) {
  if (!schoolId) {
    return null;
  }

  return schools.find((school) => school.id === schoolId) ?? null;
}

export function getSchoolDisplayName(
  schoolId: string | null | undefined,
  schools: SchoolDirectoryEntry[]
) {
  const school = resolveSchoolDirectoryEntry(schoolId, schools);
  return school ? formatSchoolDisplayName(school) : schoolId ?? "-";
}

export function useSchoolDirectory() {
  const [schools, setSchools] = useState<SchoolDirectoryEntry[]>(() => cachedSchoolDirectory ?? []);
  const [loading, setLoading] = useState(!cachedSchoolDirectory);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const nextSchools = await loadSchoolDirectory();
        if (!cancelled) {
          setSchools(nextSchools);
        }
      } catch {
        if (!cancelled) {
          setSchools([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    schools,
    loading,
  };
}

export function useSchoolDisplayName(schoolId: string | null | undefined) {
  const { schools, loading } = useSchoolDirectory();
  const schoolLabel = useMemo(() => getSchoolDisplayName(schoolId, schools), [schoolId, schools]);

  return {
    schoolLabel,
    loading,
  };
}

export function useFoundationSchoolDisplayName(
  schoolId: string | null | undefined,
  cycleId: string | null | undefined
) {
  const repository = getFniRepository();
  const { schoolLabel: directoryLabel, loading: directoryLoading } = useSchoolDisplayName(schoolId);
  const [foundationResolution, setFoundationResolution] = useState<{
    schoolId: string;
    cycleId: string;
    label: string | null;
  } | null>(null);
  const shouldResolveFromFoundation = Boolean(schoolId && cycleId && directoryLabel === schoolId);
  const foundationLabel =
    foundationResolution &&
    foundationResolution.schoolId === schoolId &&
    foundationResolution.cycleId === cycleId
      ? foundationResolution.label
      : null;
  const hasFoundationResolution =
    foundationResolution?.schoolId === schoolId && foundationResolution?.cycleId === cycleId;

  useEffect(() => {
    if (!shouldResolveFromFoundation || !schoolId || !cycleId) {
      return;
    }

    const resolvedCycleId = cycleId;
    const resolvedSchoolId = schoolId;
    let cancelled = false;

    async function loadFoundationSchoolLabel() {
      try {
        const schools = await repository.listFoundationSchools(resolvedCycleId);
        const normalizedEntries: SchoolDirectoryEntry[] = schools.map((school) => ({
          id: school.id,
          code: school.code,
          name: school.name,
          managerName: school.managerName ?? null,
          managerEmail: school.managerEmail ?? null,
        }));
        const mergedEntries = mergeSchoolDirectoryEntries(normalizedEntries);
        const school = resolveSchoolDirectoryEntry(resolvedSchoolId, mergedEntries);

        if (!cancelled) {
          setFoundationResolution({
            schoolId: resolvedSchoolId,
            cycleId: resolvedCycleId,
            label: school ? formatSchoolDisplayName(school) : null,
          });
        }
      } catch {
        if (!cancelled) {
          setFoundationResolution({
            schoolId: resolvedSchoolId,
            cycleId: resolvedCycleId,
            label: null,
          });
        }
      }
    }

    void loadFoundationSchoolLabel();

    return () => {
      cancelled = true;
    };
  }, [cycleId, directoryLabel, repository, schoolId, shouldResolveFromFoundation]);

  return {
    schoolLabel: foundationLabel ?? directoryLabel,
    loading: directoryLoading || (shouldResolveFromFoundation && !hasFoundationResolution),
  };
}
