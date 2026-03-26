import type { IndicatorSchema, Question, YesNoNA } from "./schema/evaluacionSchema";
import {
  defaultIndicatorResponse,
  type IndicatorCompletionStatus,
  type IndicatorResponse,
  type ResponseAnswer,
} from "./types";

// Logica de calculo y visibilidad compartida por todas las pantallas FNI.
// Mantenerla aqui evita que la UI duplique reglas de negocio.
type ConditionalIndicator = IndicatorSchema & {
  visibleWhen?: { indicatorId: string; key: string; equals: YesNoNA };
};

export function pctFromYesNo(value: YesNoNA | undefined) {
  if (value === "SI") return 100;
  if (value === "NO") return 0;
  return null;
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function isQuestionVisible(question: Question, answers: Record<string, ResponseAnswer>) {
  if ("visibleIf" in question && question.visibleIf) {
    return answers[question.visibleIf.key] === question.visibleIf.equals;
  }

  return true;
}

export function pruneHiddenAnswers(
  indicator: IndicatorSchema,
  answers: Record<string, ResponseAnswer>
) {
  const nextAnswers = { ...answers };

  for (const question of indicator.questions) {
    if (!isQuestionVisible(question, nextAnswers)) {
      delete nextAnswers[question.key];
    }
  }

  return nextAnswers;
}

export function isIndicatorVisible(
  indicator: IndicatorSchema,
  responses: Record<string, IndicatorResponse>
) {
  const conditionalIndicator = indicator as ConditionalIndicator;

  // Algunas dependencias viven fuera del schema para conservar compatibilidad historica.
  if (conditionalIndicator.visibleWhen) {
    const dependency = responses[conditionalIndicator.visibleWhen.indicatorId] ?? defaultIndicatorResponse();
    return dependency.answers[conditionalIndicator.visibleWhen.key] === conditionalIndicator.visibleWhen.equals;
  }

  // Reglas explicitas del catalogo que no dependen de visibleWhen en el schema.
  if (indicator.id === "asistencia-009" || indicator.id === "asistencia-010") {
    const dependency = responses["asistencia-008"] ?? defaultIndicatorResponse();
    return dependency.answers.answer === "SI";
  }

  if (indicator.id === "temas-laborales-015") {
    const dependency = responses["temas-laborales-014"] ?? defaultIndicatorResponse();
    return dependency.answers.answer === "SI";
  }

  return true;
}

export function calcIndicatorPct(
  indicator: IndicatorSchema,
  response: IndicatorResponse
): number | null {
  // Primero filtramos preguntas ocultas, porque no deben afectar el porcentaje final.
  const visibleQuestions = indicator.questions.filter((question) =>
    isQuestionVisible(question, response.answers)
  );

  const numericQuestions = visibleQuestions.filter(
    (question): question is Extract<Question, { kind: "number" }> => question.kind === "number"
  );

  if (numericQuestions.length === 1) {
    const value = response.answers[numericQuestions[0].key];
    if (typeof value === "number") {
      const normalized = value >= 0 && value <= 1 ? value * 100 : value;
      return clamp(normalized);
    }

    return null;
  }

  const yesNoQuestions = visibleQuestions.filter(
    (question): question is Extract<Question, { kind: "yesno" }> => question.kind === "yesno"
  );

  if (!yesNoQuestions.length) return null;

  // En preguntas binarias tratamos NA como "sin dato" y NO como incumplimiento.
  const getAnswer = (key: string) => {
    const answer = response.answers[key];
    return typeof answer === "number" ? undefined : answer;
  };

  const hasDocumentQuestion = yesNoQuestions.some((question) => question.key === "hasDocument");
  const isUpdatedQuestion = yesNoQuestions.some((question) => question.key === "isUpdated");

  if (hasDocumentQuestion && isUpdatedQuestion) {
    const hasDocument = getAnswer("hasDocument");
    const isUpdated = getAnswer("isUpdated");

    if ([hasDocument, isUpdated].some((value) => value == null || value === "NA")) return null;
    if (hasDocument === "NO" || isUpdated === "NO") return 0;
    return 100;
  }

  if (hasDocumentQuestion) {
    return pctFromYesNo(getAnswer("hasDocument"));
  }

  if (yesNoQuestions.length === 1) {
    return pctFromYesNo(getAnswer(yesNoQuestions[0].key));
  }

  const values = yesNoQuestions.map((question) => getAnswer(question.key));
  if (values.some((value) => value == null || value === "NA")) return null;
  if (values.some((value) => value === "NO")) return 0;
  return 100;
}

export function statusFromPct(pct: number | null): IndicatorCompletionStatus {
  if (pct == null) return "pendiente";
  if (pct >= 100) return "completo";
  return "incompleto";
}
