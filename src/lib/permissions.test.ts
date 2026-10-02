import { describe, expect, it } from 'vitest'
import { areaDaRota, homePath, pode, podeCriarLead, podeOperarLead, roleConhecido } from './permissions'
import type { UserRole } from '@/types/crm'

const ROLES: UserRole[] = ['admin', 'owner', 'gestor', 'vendedor', 'user']

describe('pode', () => {
  it('todos veem leads, clientes e agenda', () => {
    for (const r of ROLES) for (const a of ['leads', 'clientes', 'agenda'] as const) expect(pode(r, a)).toBe(true)
  })
  it('painel: todos menos vendedor', () => {
    expect(ROLES.filter(r => pode(r, 'painel'))).toEqual(['admin', 'owner', 'gestor', 'user'])
  })
  it('integracoes: admin, owner, gestor', () => {
    expect(ROLES.filter(r => pode(r, 'integracoes'))).toEqual(['admin', 'owner', 'gestor'])
  })
  it('meta: so admin e gestor', () => {
    expect(ROLES.filter(r => pode(r, 'meta'))).toEqual(['admin', 'gestor'])
  })
  it('empresa e equipe: admin e owner', () => {
    expect(ROLES.filter(r => pode(r, 'empresa'))).toEqual(['admin', 'owner'])
    expect(ROLES.filter(r => pode(r, 'equipe'))).toEqual(['admin', 'owner'])
  })
  it('ver_empresa e visualizar_como: admin, owner, gestor', () => {
    expect(ROLES.filter(r => pode(r, 'ver_empresa'))).toEqual(['admin', 'owner', 'gestor'])
    expect(ROLES.filter(r => pode(r, 'visualizar_como'))).toEqual(['admin', 'owner', 'gestor'])
  })
  it('editar_empresa: admin e owner', () => {
    expect(ROLES.filter(r => pode(r, 'editar_empresa'))).toEqual(['admin', 'owner'])
  })
  it('admin global: so admin', () => {
    expect(ROLES.filter(r => pode(r, 'admin'))).toEqual(['admin'])
  })
  it('sem role: nada', () => {
    expect(pode(null, 'leads')).toBe(false)
    expect(pode(undefined, 'leads')).toBe(false)
  })
})

describe('homePath', () => {
  it('por perfil', () => {
    expect(homePath('admin')).toBe('/admin/empresas')
    expect(homePath('owner')).toBe('/equipe')
    expect(homePath('gestor')).toBe('/equipe')
    expect(homePath('vendedor')).toBe('/atendimento')
    expect(homePath('user')).toBe('/clientes')
  })
  it('home sempre permitida (evita loop de redirect)', () => {
    for (const r of ROLES) {
      const area = areaDaRota(homePath(r))
      expect(area && pode(r, area)).toBe(true)
    }
  })
})

describe('areaDaRota', () => {
  it('mapeia prefixos', () => {
    expect(areaDaRota('/admin')).toBe('admin')
    expect(areaDaRota('/admin/empresas/x')).toBe('admin')
    expect(areaDaRota('/settings/users')).toBe('admin')
    expect(areaDaRota('/empresa')).toBe('empresa')
    expect(areaDaRota('/empresas')).toBeNull()
    expect(areaDaRota('/dashboard')).toBe('painel')
    expect(areaDaRota('/leads/123')).toBe('leads')
    expect(areaDaRota('/clientes')).toBe('clientes')
    expect(areaDaRota('/calendario')).toBe('agenda')
    expect(areaDaRota('/equipe')).toBe('ver_artistas')
    expect(areaDaRota('/atendimento')).toBe('atendimento')
    expect(areaDaRota('/settings/integrations')).toBeNull()
  })
})

describe('roleConhecido', () => {
  it('so roles da matriz', () => {
    for (const r of ROLES) expect(roleConhecido(r)).toBe(true)
    expect(roleConhecido(undefined)).toBe(false)
    expect(roleConhecido('xpto')).toBe(false)
  })
})

describe('atendimento', () => {
  it('so vendedor', () => {
    expect(ROLES.filter(r => pode(r, 'atendimento'))).toEqual(['vendedor'])
  })
})

describe('podeOperarLead', () => {
  it('proprio lead ou dono/superadmin', () => {
    expect(podeOperarLead('user', 'u1', 'u1')).toBe(true)
    expect(podeOperarLead('owner', 'o1', 'u1')).toBe(true)
    expect(podeOperarLead('gestor', 'g1', 'u1')).toBe(false)
  })
  it('vendedor so no artista que esta atendendo', () => {
    expect(podeOperarLead('vendedor', 'v1', 'u1', 'u1')).toBe(true)
    expect(podeOperarLead('vendedor', 'v1', 'u2', 'u1')).toBe(false)
    expect(podeOperarLead('vendedor', 'v1', 'u1', null)).toBe(false)
  })
})

describe('podeCriarLead', () => {
  it('sem visualizar como: todos', () => {
    for (const r of ROLES) expect(podeCriarLead(r, null)).toBe(true)
  })
  it('visualizando outro: dono, superadmin e vendedor', () => {
    expect(ROLES.filter(r => podeCriarLead(r, 'x'))).toEqual(['admin', 'owner', 'vendedor'])
  })
})

describe('ver_artistas', () => {
  it('dono, gestor e superadmin', () => {
    expect(ROLES.filter(r => pode(r, 'ver_artistas'))).toEqual(['admin', 'owner', 'gestor'])
  })
})
