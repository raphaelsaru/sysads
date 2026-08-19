export const metadata = {
  title: 'Exclusão de Dados — Prizely',
}

export default function ExclusaoDeDadosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-neutral-800">
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">Instruções de Exclusão de Dados</h1>
      <p className="mb-8 text-neutral-500">Última atualização: 19 de agosto de 2026</p>

      <p className="mb-4">
        Se você conectou sua conta do Instagram ou WhatsApp Business ao Prizely e deseja que seus dados sejam
        excluídos, siga um dos passos abaixo.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">1. Desconectar a integração</h2>
      <p className="mb-4">
        Acesse <strong>Integrações</strong> dentro do Prizely e clique em "Desconectar" no canal desejado (Instagram
        ou WhatsApp). Isso interrompe imediatamente o uso do token de acesso e o recebimento de novas mensagens.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">2. Solicitar exclusão completa dos dados</h2>
      <p className="mb-4">
        Envie um e-mail para{' '}
        <a className="underline" href="mailto:raphasaru.ads@gmail.com">raphasaru.ads@gmail.com</a> a partir do
        endereço associado à sua conta, com o assunto "Exclusão de dados". Vamos remover permanentemente:
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-5">
        <li>Tokens de acesso ao Instagram e/ou WhatsApp conectados à sua conta</li>
        <li>Leads e clientes cadastrados na sua conta</li>
        <li>Dados de perfil da sua conta de usuário no Prizely</li>
      </ul>
      <p className="mb-4">O prazo para conclusão da exclusão é de até 15 dias corridos após a solicitação.</p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">3. Revogar o acesso do app pelo Instagram/Facebook</h2>
      <p>
        Você também pode revogar o acesso do Prizely diretamente nas configurações da sua conta Meta, em
        Configurações → Aplicativos e sites → Prizely → Remover.
      </p>
    </main>
  )
}
