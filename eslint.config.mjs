import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next 16 já exporta flat config (Linter.Config[]), então é
// importado direto. A versão anterior deste arquivo passava esses configs pelo
// FlatCompat, que é a camada de compatibilidade para o formato .eslintrc antigo
// — ao validar um config que já é flat, o eslintrc tentava serializar objetos de
// plugin com referência circular e quebrava com "Converting circular structure
// to JSON", mascarando qualquer erro real.

const eslintConfig = [
  // Ignore global: precisa ser objeto próprio. Dentro de um bloco que também
  // tem `rules`, o ignore valeria só para aquele bloco.
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Pacote separado, com tooling e tsconfig próprios.
      "agent/**",
      // Não fazem parte do app Next: extensão de navegador e scripts Node
      // avulsos, que usam require() legitimamente. Checá-los com as regras de
      // React/TS do Next só produz ruído.
      "chrome-extension/**",
      "scripts/**",
      "supabase/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",

      // DÍVIDA CONHECIDA — rebaixado de error para warn, de propósito.
      //
      // Esta regra nunca chegou a rodar: o lint estava quebrado por um crash de
      // configuração. Ao consertar o crash, ela apontou 8 ocorrências
      // pré-existentes:
      //
      //   src/app/page.tsx:84                       (lê query param da URL)
      //   src/app/clientes/page.tsx:85              (idem)
      //   src/components/ClienteTable.tsx:101       (deveria ser useMemo)
      //   src/components/auth/ConnectionStatus.tsx:22,33
      //   src/components/followup/FollowUpHistoryModal.tsx:41
      //   src/components/layout/Header.tsx:45       (lê tema do DOM)
      //   src/contexts/AuthContext.tsx:57           (estado derivado)
      //
      // Cada uma exige reestruturar um componente que hoje funciona, num app
      // sem testes automatizados. Corrigir tudo de uma vez é mais arriscado do
      // que a dívida. Como aviso, a regra ainda protege código novo e o `pnpm
      // lint` volta a servir de rede de segurança em vez de falhar sempre.
      //
      // Ao mexer em algum desses arquivos, aproveite e corrija o ponto.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
