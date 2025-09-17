'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ClienteTable from '@/components/ClienteTable';
import ClienteModal from '@/components/ClienteModal';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useClientes } from '@/hooks/useClientes';
import { useAuth } from '@/contexts/AuthContext';
import { Cliente, NovoCliente } from '@/types/crm';

export default function Home() {
  return (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  );
}

function HomePage() {
  const { userProfile } = useAuth();
  const {
    clientes,
    loading,
    adicionarCliente,
    editarCliente,
    excluirCliente,
    estatisticas
  } = useClientes();

  const [mostrarModal, setMostrarModal] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | undefined>();

  const handleSubmitForm = async (dadosCliente: NovoCliente) => {
    if (clienteEditando) {
      await editarCliente(clienteEditando.id!, dadosCliente);
      setClienteEditando(undefined);
    } else {
      await adicionarCliente(dadosCliente);
    }
    setMostrarModal(false);
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setMostrarModal(true);
  };

  const handleFecharModal = () => {
    setMostrarModal(false);
    setClienteEditando(undefined);
  };

  const formatarValor = (valor: number) => {
    const currency = userProfile?.currency || 'BRL';
    const locale = currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'de-DE' : 'pt-BR';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(valor);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-theme-bodycolor dark:text-themedark-bodycolor">Carregando clientes...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-theme-headings dark:text-themedark-headings">
              CRM {userProfile?.company_name || 'Sistema'} - Gestão de Clientes
            </h1>
            <p className="text-theme-bodycolor dark:text-themedark-bodycolor">
              Gerencie seus clientes e acompanhe o progresso dos orçamentos
            </p>
          </div>

          <button
            onClick={() => setMostrarModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Novo Cliente
          </button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="card">
            <div className="card-body text-center">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-primary break-words">{estatisticas.total}</div>
              <div className="text-xs sm:text-sm text-theme-bodycolor dark:text-themedark-bodycolor">Total de Clientes</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-success break-words">{estatisticas.vendas}</div>
              <div className="text-xs sm:text-sm text-theme-bodycolor dark:text-themedark-bodycolor">Vendas</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-warning break-words">{estatisticas.emProcesso}</div>
              <div className="text-xs sm:text-sm text-theme-bodycolor dark:text-themedark-bodycolor">Em Processo</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-danger break-words">{estatisticas.naoVenda}</div>
              <div className="text-xs sm:text-sm text-theme-bodycolor dark:text-themedark-bodycolor">Não Venda</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-warning break-words">{formatarValor(estatisticas.valorEmProcesso)}</div>
              <div className="text-xs sm:text-sm text-theme-bodycolor dark:text-themedark-bodycolor">Valor em Processo</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-success break-words">{formatarValor(estatisticas.valorVendido)}</div>
              <div className="text-xs sm:text-sm text-theme-bodycolor dark:text-themedark-bodycolor">Valor Vendido</div>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <ClienteTable
          clientes={clientes}
          onEdit={handleEditarCliente}
          onDelete={excluirCliente}
        />

        {/* Modal do Cliente */}
        <ClienteModal
          isOpen={mostrarModal}
          onClose={handleFecharModal}
          onSave={handleSubmitForm}
          cliente={clienteEditando}
        />
      </div>
    </MainLayout>
  );
}
