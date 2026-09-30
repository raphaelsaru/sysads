const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

export const NOME_EMPRESA_MAX = 120
export const MAX_USERS_LIMITE = 10000

// Slots: inteiro entre 1 e MAX_USERS_LIMITE.
export const isMaxUsersValido = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_USERS_LIMITE
