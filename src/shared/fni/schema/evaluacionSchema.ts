// AUTO-GENERADO desde Excel (hoja EVALUACIÓN)
// Fuente: Fortalecimiento Normativo Institucional - FNI.xlsx
// Nota: revisar manualmente casos especiales si un indicador tiene más de 2 preguntas condicionales.

export type YesNoNA = "SI" | "NO" | "NA";

export type Question =
  | { key: string; kind: "yesno"; label: string; required?: boolean; visibleIf?: { key: string; equals: YesNoNA } }
  | { key: string; kind: "number"; label: string; required?: boolean; min?: number; max?: number; visibleIf?: { key: string; equals: YesNoNA } };

export type IndicatorSchema = {
  id: string;
  name: string;
  expectedPct: number;
  questions: Question[];
  hasDocumentFields: boolean;
  visibleWhen?: { indicatorId: string; key: string; equals: YesNoNA };
};

export type AreaSchema = {
  id: string;
  name: string;
  indicators: IndicatorSchema[];
};

export const AREAS_SCHEMA: AreaSchema[] = [
  {
    "id": "infraestructura",
    "name": "Infraestructura",
    "indicators": [
      {
        "id": "infraestructura-001",
        "name": "REX de Reconocimiento Oficial sus modificaciones",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-002",
        "name": "Certificado de recepción final de obras (actualizado)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-003",
        "name": "Certificado de autorización sanitaria",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-004",
        "name": "Certificado de autorización sanitaria para manipular alimentos",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-005",
        "name": "Contrato de Comodato, arrendamiento, o Certificado de Dominio Vigente.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-006",
        "name": "Letrero visible, indicando nombre del establecimiento, modalidad educativa, fecha y número de REX que otorgó el R.O.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-007",
        "name": "Plan integral de Seguridad Escolar (PR)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-008",
        "name": "Acta de constitución de comité de seguridad escolar. (PR)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-009",
        "name": "Documento que acredite las medidas de prevención de riesgos (PR)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-010",
        "name": "Sello Verde (SEC)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-011",
        "name": "Protocolo de accidentes escolares. (PR)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-012",
        "name": "Protocolo de actuación frente a emergencias (PR)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-013",
        "name": "Comité Paritario* (PR)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "q1",
            "kind": "yesno",
            "label": "¿El Comité Paritario está constituido?",
            "required": true
          },
          {
            "key": "q2",
            "kind": "yesno",
            "label": "Si está constituido, ¿ha sesionado 1 vez al mes?",
            "required": false,
            "visibleIf": { "key": "q1", "equals": "SI" }
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "infraestructura-014",
        "name": "Cumplimiento de m2 para la infraestructura del establecimiento (sala de clases, laboratorios, comedores, etc.) (modelo)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "q1",
            "kind": "yesno",
            "label": "¿Cumple con los m² de infraestructura según el modelo?",
            "required": true
          },
          {
            "key": "q2",
            "kind": "yesno",
            "label": "¿La información coincide con la presente dentro de la última modificación de la REX?",
            "required": false
          }
        ],
        "hasDocumentFields": true
      }
    ]
  },
  {
    "id": "asistencia",
    "name": "Asistencia",
    "indicators": [
      {
        "id": "asistencia-001",
        "name": "Libro de registro de salida de alumnos foliado",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "asistencia-002",
        "name": "Libro de clases por curso (Digital)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "asistencia-003",
        "name": "Declaración de asistencia mensual",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "asistencia-004",
        "name": "Registro de matrícula",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "asistencia-005",
        "name": "Estructura de cursos",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "asistencia-006",
        "name": "Libro de retiros",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "asistencia-007",
        "name": "Individualice el (%) que indica Syscol Web repecto de firmas docentes y llenado de contenido. (Adjunte la evidencia)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "valuePct",
            "kind": "number",
            "label": "Individualice el (%) que indica Syscol Web repecto de firmas docentes y llenado de contenido. (Adjunte la evidencia)",
            "min": 0,
            "max": 100,
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "asistencia-008",
        "name": "¿Tiene excedentes?",
        "expectedPct": 100,
        "questions": [
          {
            "key": "answer",
            "kind": "yesno",
            "label": "¿Tiene excedentes?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "asistencia-009",
        "name": "Resolución con alumnos excedentes (si corresponde)",
        "expectedPct": 100,
        "visibleWhen": { "indicatorId": "asistencia-008", "key": "answer", "equals": "SI" },
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "asistencia-010",
        "name": "Autorización de sobrecupos si corresponde",
        "expectedPct": 100,
        "visibleWhen": { "indicatorId": "asistencia-008", "key": "answer", "equals": "SI" },
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      }
    ]
  },
  {
    "id": "temas-laborales",
    "name": "Temas Laborales",
    "indicators": [
      {
        "id": "temas-laborales-001",
        "name": "Título profesional del representante legal, en original o copia autorizada o legalizada.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-002",
        "name": "Declaración en SET 12 del personal docente y asistente de la educación.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-003",
        "name": "Título de docentes, asistentes de párvulos o técnicos de educación diferencial en original o copia autorizada o legalizada.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-004",
        "name": "Autorización de docentes.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-005",
        "name": "Título o habilitación docente y profesionales asistentes de la educación de apoyo PIE.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "q1",
            "kind": "yesno",
            "label": "¿Cuántos trabajadores hay en total?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-006",
        "name": "Certificado de antecedentes para fines especiales de representante legal.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-007",
        "name": "Certificado de antecedentes para fines especiales de los trabajadores",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-008",
        "name": "Certificado de licenciatura para fines laborales, emitido por el MINEDUC para los asistentes de la educación (ingresados desde el 2008).",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-009",
        "name": "Certificado de idoneidad psicológica para asistentes de la educación (ingresados desde el 2008).",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-010",
        "name": "Certificado de idoneidad profesores de religión (lo emite la Delegación para la Educación)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-011",
        "name": "Certificado de idoneidad moral actualizado para trabajar con menores de edad (todo el personal del colegio.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-012",
        "name": "Contratos de trabajo y anexos.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-013",
        "name": "Distribución y carga horaria docente.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-014",
        "name": "¿El colegio cuenta con trabajadores extranjeros?",
        "expectedPct": 100,
        "questions": [
          {
            "key": "answer",
            "kind": "yesno",
            "label": "¿El colegio cuenta con trabajadores extranjeros?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-laborales-015",
        "name": "Documentación laboral de extranjeros. (título apostillado, habilitación eventualmente, permiso de trabajo, etc.)",
        "expectedPct": 100,
        "visibleWhen": { "indicatorId": "temas-laborales-014", "key": "answer", "equals": "SI" },
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      }
    ]
  },
  {
    "id": "temas-acad-micos",
    "name": "Temas académicos",
    "indicators": [
      {
        "id": "temas-acad-micos-001",
        "name": "Proyecto educativo institucional.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-002",
        "name": "Última JEC aprobada por DEPROV",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-003",
        "name": "Evidencia de ejecución de horas TP (actas de: reuniones, consejos de profesores, registro de talleres, entre otros.)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-004",
        "name": "Certificado del colegio que acredita el año de ingreso al programa PIE (esto se solicita en supervisiones específicas a PIE)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-005",
        "name": "Plan de Inclusión vigente.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-006",
        "name": "Plan local de desarrollo Profesional docente vigente",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-007",
        "name": "Compromiso Plan de Acompañamiento y autorización de apoderado (en reglamento de Evaluación (...)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-008",
        "name": "Certificado de nacimiento",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-009",
        "name": "Informes de Familia",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-010",
        "name": "Matrícula del colegio sin considerar educación parvularia",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-011",
        "name": "Certificados de promoción escolar (En las fiscalizaciones se pueden pedir muestras aleatorias)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-012",
        "name": "Carpetas PIE por Estudiante con todas las evidencias solicitadas en normativa vigente.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-013",
        "name": "Reglamento de evaluación, promoción y calificación actualizado, y evidencia de su difusión.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-014",
        "name": "Actas de consejo escolares con todas las firmas correspondientes.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-015",
        "name": "Consejo de Profesores",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-016",
        "name": "Consejo de Apoderados",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-017",
        "name": "¿El colegio cuenta con formación Técnico Profesional (TP)?",
        "expectedPct": 100,
        "questions": [
          {
            "key": "answer",
            "kind": "yesno",
            "label": "¿El colegio cuenta con formación Técnico Profesional (TP)?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-018",
        "name": "Beneficios a estudiantes en práctica profesional",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-019",
        "name": "Reglamento vigente de práctica profesional T.P.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-020",
        "name": "Resolución de especialidad T.P.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "temas-acad-micos-021",
        "name": "Expediente de titulación (Informes de práctica firmados por todas las partes: centro de práctica - tutor de práctica - director(a)",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      }
    ]
  },
  {
    "id": "formaci-n-y-convivencia",
    "name": "Formación y Convivencia",
    "indicators": [
      {
        "id": "formaci-n-y-convivencia-001",
        "name": "Plan de gestión de convivencia escolar",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-002",
        "name": "Plan de formación ciudadana",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-003",
        "name": "Plan de afectividad, sexualidad y género",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-004",
        "name": "Registro de capacitación al personal sobre convivencia escolar.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-005",
        "name": "Nombramiento del encargado de convivencia escolar y difusión en la comunidad educativa.",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-006",
        "name": "Reglamento interno y evidencia de su difusión",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-007",
        "name": "Se constituyó el consejo escolar?",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-008",
        "name": "En base a consejo escolar",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-009",
        "name": "Sistema de Admisión escolar:",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-010",
        "name": "Documento capacidad total colegio",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-011",
        "name": "Documento estructura de curso",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-012",
        "name": "Comprobante registro de cupos",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-013",
        "name": "Matrícula",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-014",
        "name": "Libro de registro público",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-015",
        "name": "Certificado de traslado para estudiantes que se retiran",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-016",
        "name": "Comprobante de matrícula",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-017",
        "name": "Contrato de prestación de servicios educacional",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "formaci-n-y-convivencia-018",
        "name": "Cupos",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      }
    ]
  },
  {
    "id": "otros",
    "name": "Otros",
    "indicators": [
      {
        "id": "otros-001",
        "name": "Letrero Ley TEA",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "otros-002",
        "name": "¿Se realizó la Cuenta Pública?",
        "expectedPct": 100,
        "questions": [
          {
            "key": "answer",
            "kind": "yesno",
            "label": "¿Se realizó la Cuenta Pública?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      },
      {
        "id": "otros-003",
        "name": "En base a Cuenta Pública",
        "expectedPct": 100,
        "questions": [
          {
            "key": "hasDocument",
            "kind": "yesno",
            "label": "¿Cuenta con el documento?",
            "required": true
          }
        ],
        "hasDocumentFields": true
      }
    ]
  }
] as const;
