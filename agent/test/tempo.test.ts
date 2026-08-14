import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zonaValida, hojeNaZona, ZONA_PADRAO } from '../src/tempo.ts'

test('zonas IANA reais passam', () => {
  for (const z of ['America/Sao_Paulo', 'America/New_York', 'Europe/Lisbon', 'UTC', 'Asia/Tokyo']) {
    assert.equal(zonaValida(z), true, z)
  }
})

test('zonas inválidas ou lixo não passam', () => {
  for (const z of [
    '',
    '   ',
    'Nao/Existe',
    'America/Sao Paulo',
    null,
    undefined,
    42,
    {},
    ['America/Sao_Paulo'],
    'A'.repeat(200),
    "America/Sao_Paulo'; DROP TABLE clientes--",
  ]) {
    assert.equal(zonaValida(z), false, JSON.stringify(z))
  }
})

test('hoje é calculado na zona pedida, não em UTC', () => {
  // 2026-08-14T01:30Z: já é dia 14 em UTC, ainda é dia 13 em São Paulo (UTC-3).
  const agora = new Date('2026-08-14T01:30:00Z')
  assert.equal(hojeNaZona('America/Sao_Paulo', agora), '2026-08-13')
  assert.equal(hojeNaZona('America/New_York', agora), '2026-08-13')
  assert.equal(hojeNaZona('UTC', agora), '2026-08-14')
  assert.equal(hojeNaZona('Asia/Tokyo', agora), '2026-08-14')
})

test('zona ausente ou inválida cai em America/Sao_Paulo', () => {
  const agora = new Date('2026-08-14T01:30:00Z')
  assert.equal(hojeNaZona(undefined, agora), '2026-08-13')
  assert.equal(hojeNaZona('Nao/Existe', agora), '2026-08-13')
  assert.equal(hojeNaZona(99, agora), '2026-08-13')
  assert.equal(hojeNaZona(undefined, agora), hojeNaZona(ZONA_PADRAO, agora))
})

test('formato é sempre YYYY-MM-DD', () => {
  for (const z of ['America/Sao_Paulo', 'UTC', 'Asia/Tokyo', 'lixo']) {
    assert.match(hojeNaZona(z, new Date('2026-01-05T12:00:00Z')), /^\d{4}-\d{2}-\d{2}$/)
  }
})
