export type YesNo = "SI" | "NO" | "NA";

export type Question =
  | { key: string; kind: "yesno"; label: string; required?: boolean; visibleIf?: { key: string; equals: YesNo } }
  | { key: string; kind: "text"; label: string; required?: boolean; visibleIf?: { key: string; equals: YesNo } };

export type IndicatorSchema = {
  id: string;
  name: string;
  expectedPct: number;
  questions: Question[];
  hasDocumentFields: boolean;
};

export const infraestructura = {
  areaId: "infraestructura",
  areaName: "Infraestructura",
  indicators: [
    {
      id: "infra-001",
      name: "REX de Reconocimiento Oficial sus modificaciones",
      expectedPct: 100,
      questions: [
        { key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true },
      ],
      hasDocumentFields: true,
    },
    {
      id: "infra-002",
      name: "Certificado de recepción final de obras (actualizado)",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
    {
      id: "infra-003",
      name: "Certificado de autorización sanitaria",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
    {
      id: "infra-004",
      name: "Certificado de autorización sanitaria para manipular alimentos",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
    {
      id: "infra-005",
      name: "Contrato de Comodato, arrendamiento, o Certificado de Dominio Vigente.",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
    {
      id: "infra-006",
      name: "Letrero visible, indicando nombre del establecimiento, modalidad educativa, fecha y número de REX que otorgó el R.O.",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
    {
      id: "infra-007",
      name: "Plan integral de Seguridad Escolar (PR)",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
    {
      id: "infra-008",
      name: "Acta de constitución de comité de seguridad escolar. (PR)",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
    {
      id: "infra-009",
      name: "Documento que acredite las medidas de prevención de riesgos (PR)",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
    {
      id: "infra-010",
      name: "Sello Verde (SEC)",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
    {
      id: "infra-011",
      name: "Protocolo de accidentes escolares. (PR)",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
    {
      id: "infra-012",
      name: "Protocolo de actuación frente a emergencias (PR)",
      expectedPct: 100,
      questions: [{ key: "hasDocument", kind: "yesno", label: "¿Cuenta con el documento?", required: true }],
      hasDocumentFields: true,
    },
{
  id: "infra-013",
  name: "Comité Paritario* (PR)",
  expectedPct: 100,
  questions: [
    { key: "constituted", kind: "yesno", label: "¿El Comité Paritario está constituido?", required: true },
    {
      key: "meetsMonthly",
      kind: "yesno",
      label: "Si está constituido, ¿ha sesionado 1 vez al mes?",
      visibleIf: { key: "constituted", equals: "SI" },
      required: false,
    },
  ],
  hasDocumentFields: true,
},

{
  id: "infra-014",
  name: "Cumplimiento de m2 para la infraestructura del establecimiento (sala de clases, laboratorios, comedores, etc.) (modelo)",
  expectedPct: 100,
  questions: [
    { key: "meetsModel", kind: "yesno", label: "¿Cumple con los m² de infraestructura según el modelo?", required: true },
    {
      key: "infoMatchesRex",
      kind: "yesno",
      label: "¿La información coincide con la presente dentro de la última modificación de la REX?",
      required: false,
    },
  ],
  hasDocumentFields: true,
},
  ] satisfies IndicatorSchema[],
} as const;
