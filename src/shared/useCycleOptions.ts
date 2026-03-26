import { useEffect, useMemo, useState } from "react";

import { listCycles } from "./admin/client";
import type { CycleSummaryDto } from "./admin/apiContracts";

// Hook simple para poblar selects de ciclo sin repetir ordenamiento en cada pantalla.
function sortCycles(cycles: CycleSummaryDto[]) {
  return [...cycles].sort((left, right) => right.id.localeCompare(left.id));
}

export function useCycleOptions(selectedCycleId?: string | null, reloadKey?: string | number) {
  const [cycles, setCycles] = useState<CycleSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Si el usuario cambia de ciclo o refresca, volvemos a pedir la lista completa.
      setLoading(true);

      try {
        const nextCycles = sortCycles(await listCycles());
        if (!cancelled) {
          setCycles(nextCycles);
        }
      } catch {
        if (!cancelled) {
          setCycles([]);
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
  }, [reloadKey]);

  const options = useMemo(() => {
    // Si el ciclo seleccionado no viene en la lista, lo preservamos para no romper la vista actual.
    if (!selectedCycleId || cycles.some((cycle) => cycle.id === selectedCycleId)) {
      return cycles;
    }

    return [
      {
        id: selectedCycleId,
        name: `Ciclo ${selectedCycleId}`,
        status: "OPEN" as const,
        startsAt: null,
        endsAt: null,
        closedAt: null,
        isClosed: false,
      },
      ...cycles,
    ];
  }, [cycles, selectedCycleId]);

  return {
    cycles: options,
    loading,
  };
}
