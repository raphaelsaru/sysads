// IDs fixos do Victor e da Charbelle (Supabase auth.users) — categorias por usuário
export const VICTOR_USER_ID = '21662ef5-cba6-403f-a5d0-7ce66e35aee8'
export const CHARBELLE_USER_ID = '193aed03-650f-43ed-82e7-3be20113d6e0'

export const CATEGORIAS_POR_USUARIO: Record<string, readonly string[]> = {
  [VICTOR_USER_ID]: ['Tattoo Nova', 'Cobertura'],
  [CHARBELLE_USER_ID]: ['Tattoo', 'Mentoria'],
}

export function getCategoriasParaUsuario(userId?: string | null): readonly string[] {
  if (!userId) return []
  return CATEGORIAS_POR_USUARIO[userId] ?? []
}
