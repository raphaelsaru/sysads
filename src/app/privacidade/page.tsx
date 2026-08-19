export const metadata = {
  title: 'Política de Privacidade — Prizely',
}

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-neutral-800">
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">Política de Privacidade — Prizely</h1>
      <p className="mb-8 text-neutral-500">Última atualização: 19 de agosto de 2026</p>

      <p className="mb-4">
        O Prizely é um CRM que ajuda profissionais e pequenos negócios a organizar leads e clientes recebidos por
        canais como WhatsApp e Instagram. Esta política explica quais dados coletamos, como usamos e como você pode
        solicitar a exclusão deles.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">Responsável pelos dados</h2>
      <p className="mb-4">
        Raphael Silva — contato: <a className="underline" href="mailto:raphasaru.ads@gmail.com">raphasaru.ads@gmail.com</a>
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">Dados que coletamos</h2>
      <ul className="mb-4 list-disc space-y-2 pl-5">
        <li>
          <strong>Dados de conta:</strong> nome, e-mail e credenciais de autenticação do usuário do Prizely (dono do
          negócio que usa o CRM).
        </li>
        <li>
          <strong>Dados de integração com o Instagram:</strong> quando o usuário conecta sua conta comercial do
          Instagram, armazenamos o identificador da conta (Instagram User ID), o nome de usuário e um token de acesso
          de longa duração, usado exclusivamente para receber mensagens diretas (DMs) enviadas à conta conectada.
        </li>
        <li>
          <strong>Dados de mensagens recebidas:</strong> quando alguém envia uma DM para a conta do Instagram
          conectada, registramos o identificador do remetente, o nome de usuário público (quando disponível) e a data
          do contato, para criar automaticamente um "lead" no CRM do usuário. O conteúdo da mensagem em si não é
          armazenado — apenas o fato de que houve contato.
        </li>
        <li>
          <strong>Dados de integração com WhatsApp:</strong> de forma semelhante, número de telefone e nome de
          contato de quem envia mensagem para o WhatsApp Business conectado.
        </li>
      </ul>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">Como usamos os dados</h2>
      <p className="mb-4">
        Os dados são usados exclusivamente para permitir que o usuário do Prizely visualize e gerencie seus próprios
        leads e clientes dentro do CRM. Não vendemos, alugamos ou compartilhamos esses dados com terceiros para fins
        de publicidade. Não usamos os dados de mensagens para treinar modelos de inteligência artificial de terceiros.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">Armazenamento e segurança</h2>
      <p className="mb-4">
        Os dados são armazenados em banco de dados gerenciado (Supabase/PostgreSQL), com controle de acesso restrito
        por conta de usuário (Row Level Security). Tokens de acesso a APIs de terceiros (Instagram, WhatsApp) são
        armazenados de forma segura e usados apenas em chamadas de servidor, nunca expostos ao navegador do usuário
        final.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">Exclusão de dados</h2>
      <p className="mb-4">
        Qualquer usuário pode solicitar a exclusão completa de sua conta e dos dados associados (incluindo tokens de
        integração e leads) a qualquer momento, enviando um e-mail para{' '}
        <a className="underline" href="mailto:raphasaru.ads@gmail.com">raphasaru.ads@gmail.com</a>. Veja também nossa{' '}
        <a className="underline" href="/exclusao-de-dados">página de instruções de exclusão de dados</a>.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">Revogação de acesso</h2>
      <p className="mb-4">
        O usuário pode desconectar sua conta do Instagram ou WhatsApp a qualquer momento diretamente no Prizely (tela
        de Integrações), o que interrompe imediatamente o recebimento de novas mensagens e pode ser seguido de
        revogação do acesso do app também diretamente nas configurações do Instagram/Facebook do usuário.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">Contato</h2>
      <p>
        Dúvidas sobre esta política podem ser enviadas para{' '}
        <a className="underline" href="mailto:raphasaru.ads@gmail.com">raphasaru.ads@gmail.com</a>.
      </p>
    </main>
  )
}
