import type { UserRole } from '@/types/crm'

// Matriz de acesso por perfil. Fonte única p/ Sidebar, middleware e APIs.
// Design: docs/plans/2026-10-01-perfis-acesso-design.md
export type Area =
  | 'leads' | 'clientes' | 'agenda' | 'painel'
  | 'integracoes'      // menu Integrações (empresa)
  | 'meta'             // card/API Meta CAPI
  | 'empresa'          // /empresa (cor, equipe)
  | 'equipe'           // convidar/gerenciar usuários
  | 'ver_empresa'      // lê dados de toda a empresa
  | 'editar_empresa'   // edita/exclui dados de outros usuários
  | 'visualizar_como'
  | 'admin'            // painel global superadmin

const BASE: readonly Area[] = ['leads', 'clientes', 'agenda']

const MATRIZ: Record<UserRole, readonly Area[]> = {
  admin: [...BASE, 'painel', 'integracoes', 'meta', 'empresa', 'equipe', 'ver_empresa', 'editar_empresa', 'visualizar_como', 'admin'],
  owner: [...BASE, 'painel', 'integracoes', 'empresa', 'equipe', 'ver_empresa', 'editar_empresa', 'visualizar_como'],
  gestor: [...BASE, 'painel', 'integracoes', 'meta', 'ver_empresa', 'visualizar_como'],
  vendedor: BASE,
  user: [...BASE, 'painel'],
}

// Role existe na matriz? (perfil não carregado/enum novo → false)
export function roleConhecido(role: unknown): role is UserRole {
  return typeof role === 'string' && Object.hasOwn(MATRIZ, role)
}

// Guard p/ role desconhecido vindo do banco em runtime.
export function pode(role: UserRole | null | undefined, area: Area): boolean {
  return !!role && (MATRIZ[role]?.includes(area) ?? false)
}

const HOME: Record<UserRole, string> = {
  admin: '/admin/empresas',
  owner: '/equipe',
  gestor: '/leads',
  vendedor: '/leads',
  user: '/clientes',
}

export function homePath(role: UserRole | null | undefined): string {
  return (role && HOME[role]) || '/leads'
}

// Prefixo de rota → área exigida. Rotas fora da lista não são restritas por perfil.
const ROTAS: [string, Area][] = [
  ['/admin', 'admin'],
  ['/settings/users', 'admin'],
  ['/empresa', 'empresa'],
  ['/equipe', 'equipe'],
  ['/dashboard', 'painel'],
  ['/leads', 'leads'],
  ['/clientes', 'clientes'],
  ['/calendario', 'agenda'],
]

export function areaDaRota(pathname: string): Area | null {
  const achada = ROTAS.find(([base]) => pathname === base || pathname.startsWith(base + '/'))
  return achada ? achada[1] : null
}
