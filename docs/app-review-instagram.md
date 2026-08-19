# Análise do App — Integração Instagram (Prizely)

## URLs a preencher no painel

- **Política de Privacidade:** `https://www.prizely.com.br/privacidade`
- **Instruções de Exclusão de Dados:** `https://www.prizely.com.br/exclusao-de-dados`
- **URL do app:** `https://www.prizely.com.br`
- **Categoria:** Business (CRM / Ferramentas de negócio)

## Permissões a solicitar

### `instagram_business_basic`

**Como o app usa:** Após o dono do negócio conectar sua conta comercial do Instagram via OAuth, o Prizely usa essa
permissão apenas para identificar a conta conectada (ID e nome de usuário), exibido na tela de Integrações como
confirmação de que a conexão foi bem-sucedida.

### `instagram_business_manage_messages`

**Como o app usa:** O Prizely é um CRM para pequenos negócios que recebem leads por DM no Instagram. Com essa
permissão, o app recebe via webhook as mensagens diretas enviadas à conta comercial conectada e cria automaticamente
um registro de "lead" no CRM do usuário (nome de usuário de quem mandou a mensagem + data do contato), eliminando o
cadastro manual. O app não envia mensagens automatizadas nem acessa o conteúdo de conversas antigas — só reage a
novas mensagens recebidas em tempo real.

## Roteiro do vídeo de demonstração (screencast)

Grave em tela cheia, narrando ou com legendas, mostrando o fluxo completo ponta a ponta. Duração alvo: 2–3 minutos.

1. **Login no Prizely** (10s) — abra `prizely.com.br`, faça login com uma conta de teste.
2. **Tela de Integrações** (10s) — navegue até Configurações → Integrações, mostre o card "Instagram" com o botão
   "Conectar Instagram".
3. **Fluxo OAuth** (30s) — clique em "Conectar Instagram", mostre a tela de login/autorização do Instagram
   (`instagram.com/oauth/authorize`) pedindo as permissões `instagram_business_basic` e
   `instagram_business_manage_messages`, autorize.
4. **Confirmação de conexão** (10s) — volte pro Prizely, mostre o card "Instagram" agora como "Conectado —
   @usuario_da_conta".
5. **Simular um lead chegando** (40s) — de outra conta do Instagram (celular, por exemplo), envie uma DM para a
   conta comercial conectada. Em seguida mostre o CRM do Prizely (tela de Leads) atualizando com o novo lead: nome de
   usuário, origem "Instagram", data do contato.
6. **Desconectar** (10s) — mostre o botão "Desconectar" na tela de Integrações e explique que isso revoga o uso do
   token imediatamente.

## Descrição geral do app (campo "O que o app faz")

> Prizely é um CRM para pequenos negócios (ex: estúdios de tatuagem, prestadores de serviço) organizarem leads
> recebidos por diferentes canais. A integração com Instagram permite que o dono do negócio conecte sua conta
> comercial e receba automaticamente, dentro do CRM, um registro de cada pessoa que iniciar uma conversa por DM —
> sem precisar cadastrar cada contato manualmente.
