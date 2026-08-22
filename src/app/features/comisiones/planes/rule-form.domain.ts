// Constantes y mapeos del editor de reglas (comunes a crear y editar).
// Los textos de las condiciones son los que ve el usuario; el API guarda los
// operadores en inglés, así que el mapeo va en las dos direcciones.

import { ConditionOperator, ValueType } from './commission-rules.api';

export const DATE_FIELD_OPTIONS = [
  'Fecha Efectiva',
  'Fecha Vencimiento',
  'Fecha Creación',
];

export const NUMERIC_CONDITION_OPTIONS = [
  'Igual',
  'No Igual',
  'Mayor Que',
  'Mayor o Igual Que',
  'Menor Que',
  'Menor o Igual Que',
  'En (Dentro de)',
  'No en (Excepto en)',
  'Entre',
];

export const STRING_CONDITION_OPTIONS = [
  'Igual',
  'No Igual',
  'Contiene',
  'No Contiene',
  'Comienza Con',
  'Termina Con',
  'En (Dentro de)',
  'No en (Excepto en)',
];

export const MATH_OPERATORS: { symbol: string; label: string }[] = [
  { symbol: '%', label: '%' },
  { symbol: '*', label: '×' },
  { symbol: '/', label: '÷' },
  { symbol: '+', label: '+' },
  { symbol: '-', label: '-' },
  { symbol: '(', label: '(' },
  { symbol: ')', label: ')' },
  { symbol: ',', label: ',' },
];

export const FORMULA_FUNCTIONS = [
  'max',
  'min',
  'sum',
  'avg',
  'count',
  'coalesce',
  'greatest',
  'least',
  'abs',
  'round',
  'floor',
  'ceil',
  'cast',
];

const UI_A_API: Record<string, ConditionOperator> = {
  Igual: 'equal',
  'No Igual': 'not_equal',
  'Mayor Que': 'greater_than',
  'Mayor o Igual Que': 'greater_or_equal',
  'Menor Que': 'less_than',
  'Menor o Igual Que': 'less_or_equal',
  Contiene: 'contains',
  'No Contiene': 'not_contains',
  'Comienza Con': 'starts_with',
  'Termina Con': 'ends_with',
  'En (Dentro de)': 'in',
  'No en (Excepto en)': 'not_in',
  Entre: 'between',
};

/** El API acepta dos alias para mayor/mayor-igual (bigger_* y greater_*). */
const API_A_UI: Record<string, string> = {
  equal: 'Igual',
  not_equal: 'No Igual',
  greater_than: 'Mayor Que',
  bigger_than: 'Mayor Que',
  greater_or_equal: 'Mayor o Igual Que',
  bigger_or_equal: 'Mayor o Igual Que',
  less_than: 'Menor Que',
  less_or_equal: 'Menor o Igual Que',
  contains: 'Contiene',
  not_contains: 'No Contiene',
  starts_with: 'Comienza Con',
  ends_with: 'Termina Con',
  in: 'En (Dentro de)',
  not_in: 'No en (Excepto en)',
  between: 'Entre',
};

/** Símbolos cortos para el resumen de condiciones que muestra la tabla. */
const API_A_SIMBOLO: Record<string, string> = {
  equal: '==',
  not_equal: '!=',
  greater_than: '>',
  bigger_than: '>',
  greater_or_equal: '>=',
  bigger_or_equal: '>=',
  less_than: '<',
  less_or_equal: '<=',
  contains: 'contiene',
  not_contains: 'no contiene',
  starts_with: 'empieza con',
  ends_with: 'termina con',
  in: 'en',
};

export function mapUIOperatorToAPI(uiOperator: string): ConditionOperator {
  return UI_A_API[uiOperator] || 'equal';
}

export function mapApiOperatorToUI(apiOperator: string): string {
  return API_A_UI[apiOperator] || 'Igual';
}

export function mapApiOperatorToShort(apiOperator: string): string {
  return API_A_SIMBOLO[apiOperator] || apiOperator;
}

/** Las opciones de condición dependen del tipo del campo del catálogo. */
export function getConditionOptions(fieldType?: string): string[] {
  if (!fieldType) return [];
  const t = fieldType.toLowerCase();
  if (
    ['numeric', 'int', 'integer', 'bigint', 'decimal', 'double', 'money', 'date', 'datetime'].includes(
      t,
    )
  ) {
    return NUMERIC_CONDITION_OPTIONS;
  }
  return STRING_CONDITION_OPTIONS;
}

/** Fila de condición en el formulario (id temporal `temp-*` si aún no está en el API). */
export interface ConditionRow {
  id: string;
  field: string;
  fieldId?: string;
  fieldType?: string;
  condition: string;
  valueType: ValueType;
  value: string;
}
