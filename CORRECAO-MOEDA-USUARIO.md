# Correção de Moeda do Usuário

## Problema
O usuário `089f1b57-933c-40a2-b119-6a104f5b8a03` estava vendo a moeda BRL no frontend, mas deveria ser USD.

## Causa Identificada
1. O campo `preferences` na tabela `user_profiles` estava vazio (`{}`). O frontend (em `AuthContext.tsx`) busca a moeda preferida em `user_profiles.preferences.currency`. Como estava vazio, ele usava o fallback (BRL).
2. O dashboard (`src/app/dashboard/page.tsx`) estava usando `FALLBACK_CURRENCY_VALUE` hardcoded em vez de usar a moeda do usuário.

## Correções Aplicadas

### 1. Atualização do Banco de Dados
Foi executado um comando SQL para atualizar as preferências do usuário:

```sql
UPDATE user_profiles 
SET preferences = jsonb_set(COALESCE(preferences, '{}'::jsonb), '{currency}', '"USD"')
WHERE id = '089f1b57-933c-40a2-b119-6a104f5b8a03';
```

Agora o campo `preferences` contém `{"currency": "USD"}`.

### 2. Correção do Dashboard
O arquivo `src/app/dashboard/page.tsx` foi corrigido para usar a moeda do usuário em vez do valor hardcoded:

**Antes:**
```typescript
const currency = FALLBACK_CURRENCY_VALUE as 'BRL' | 'USD' | 'EUR'
```

**Depois:**
```typescript
const currency = (impersonatedUser?.currency ?? userProfile?.currency ?? FALLBACK_CURRENCY_VALUE) as 'BRL' | 'USD' | 'EUR'
```

### 3. Correção da API Admin
O arquivo `src/app/api/admin/users/route.ts` estava retornando a moeda hardcoded como 'BRL' para todos os usuários. Foi corrigido para:

- Buscar o campo `preferences` da tabela `user_profiles`
- Extrair a moeda de `preferences.currency`
- Usar fallback para `user_metadata.currency` se não houver em preferences
- Usar 'BRL' apenas como último fallback

**Antes:**
```typescript
currency: 'BRL',
```

**Depois:**
```typescript
const preferences = (profile.preferences as Record<string, unknown>) || {}
const currencyFromPreferences = preferences.currency as 'BRL' | 'USD' | 'EUR' | null | undefined
const currencyFromMetadata = authUser?.user_metadata?.currency as 'BRL' | 'USD' | 'EUR' | null | undefined
const currency = currencyFromPreferences ?? currencyFromMetadata ?? 'BRL'
```

### 4. Logs de Debug Adicionados
Foram adicionados logs temporários em `AuthContext.tsx` para facilitar o debug da moeda carregada.

## Próximos Passos
**IMPORTANTE:** 
1. O usuário precisa **recarregar a página** ou fazer **logout/login** para que o perfil seja recarregado com as novas preferências do banco de dados.
2. Na página admin, após a correção da API, os usuários listados agora mostrarão a moeda correta. Quando o admin selecionar "Visualizar como" um usuário, a moeda será carregada corretamente do banco de dados.

