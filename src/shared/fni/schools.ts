export type FoundationReviewStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "OBSERVED"
  | "APPROVED"
  | "BLOCKED";

export type FoundationSchoolRow = {
  id: string;
  code: string;
  name: string;
  managerName?: string;
  managerEmail?: string;
  cycleId: string;
  completionPct: number;
  status: FoundationReviewStatus;
  lastActivityAt?: string;
  pendingCount?: number;
  observedCount?: number;
  blockingCount?: number;
  missingEvidenceCount?: number;
};

const CANONICAL_SCHOOL_NAMES: Record<string, string> = {
  CC: "Casa Central",
  CACE: "Colegio Arzobispo Crescente Errazuriz",
  CAMV: "Colegio Arzobispo Manuel Vicuña",
  CCOC: "Colegio Carlos Oviedo Cavada",
  CJFF: "Colegio Juan Francisco Fresno",
  CJLU: "Colegio Juan Luis Undurraga",
  CJMC: "Colegio José María Caro",
  CLS: "Colegio Lorenzo Sazié de Molokai",
  CPD: "Colegio Padre Damián de Molokai",
  CRSH: "Colegio Raúl Silva Henríquez",
  CSAH: "Colegio San Alberto Hurtado",
  CSDM: "Colegio San Damián de Molokai",
  CSFA: "Colegio San Francisco de Asís de Molokai",
};

export function normalizeSchoolName(code: string, name: string) {
  const canonical = CANONICAL_SCHOOL_NAMES[code];
  return canonical ?? name;
}
