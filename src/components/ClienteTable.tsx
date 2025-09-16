'use client';

import { useState, useRef, useEffect } from 'react';
import { Cliente } from '@/types/crm';

interface ClienteTableProps {
  clientes: Cliente[];
  onEdit?: (cliente: Cliente) => void;
  onDelete?: (id: string) => void;
}

interface SwipeCardProps {
  cliente: Cliente;
  onEdit?: (cliente: Cliente) => void;
  onDelete?: (id: string) => void;
}

function SwipeCard({ cliente, onEdit, onDelete }: SwipeCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);

  // Fechar ações quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setSwipeOffset(0);
      }
    };

    if (swipeOffset > 0) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [swipeOffset]);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Previne scroll da página
    setIsDragging(true);
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault(); // Previne scroll da página

    currentX.current = e.touches[0].clientX;
    const diffX = startX.current - currentX.current;

    // Permite swipe para esquerda (abrir) e direita (fechar)
    if (diffX > 0) {
      // Swipe para esquerda - abre as ações
      setSwipeOffset(Math.min(diffX, 80));
    } else if (diffX < 0 && swipeOffset > 0) {
      // Swipe para direita - fecha as ações (só se já estiver aberto)
      setSwipeOffset(Math.max(0, swipeOffset + diffX));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Se swipou mais de 40px para esquerda, mantém aberto
    // Se swipou para direita ou menos de 40px, fecha
    if (swipeOffset > 40) {
      setSwipeOffset(80);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startX.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    currentX.current = e.clientX;
    const diffX = startX.current - currentX.current;

    if (diffX > 0) {
      setSwipeOffset(Math.min(diffX, 80));
    } else if (diffX < 0 && swipeOffset > 0) {
      setSwipeOffset(Math.max(0, swipeOffset + diffX));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (swipeOffset > 40) {
      setSwipeOffset(80);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (onDelete && cliente.id) {
      onDelete(cliente.id);
    }
    setShowDeleteModal(false);
    setSwipeOffset(0);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
  };

  const getStatusBadge = (resultado: string) => {
    const baseClasses = "badge text-xs font-medium px-2 py-1 rounded-full";
    switch (resultado) {
      case 'Venda':
        return `${baseClasses} bg-success text-white`;
      case 'Orçamento em Processo':
        return `${baseClasses} bg-warning text-white`;
      case 'Não Venda':
        return `${baseClasses} bg-danger text-white`;
      default:
        return `${baseClasses} bg-secondary text-white`;
    }
  };

  return (
    <div
      ref={cardRef}
      className="relative bg-white dark:bg-themedark-cardbg rounded-lg shadow-sm border border-theme-border dark:border-themedark-border mb-3"
    >
      {/* Card Content - sempre fixo */}
      <div
        className="relative bg-white dark:bg-themedark-cardbg p-4 rounded-lg touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={isDragging ? handleMouseMove : undefined}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ touchAction: 'pan-y' }}
      >
        <div className="flex justify-between items-center">
          {/* Nome sempre visível à esquerda */}
          <div className="flex-1 min-w-0 pr-4">
            <h4 className="font-semibold text-theme-headings dark:text-themedark-headings">
              {cliente.nome}
            </h4>
            <p className="text-sm text-theme-bodycolor dark:text-themedark-bodycolor">
              {cliente.dataContato}
            </p>
          </div>

          {/* Valor e status à direita */}
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-success">
              {cliente.valorFechado || '-'}
            </div>
            <div className="mt-1">
              <span className={getStatusBadge(cliente.resultado)}>
                {cliente.resultado}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Overlay - aparece por cima quando swipe > 0 */}
      {swipeOffset > 0 && (
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-50 dark:bg-red-900/20 transition-all duration-200 rounded-r-lg"
          style={{
            width: `${Math.min(swipeOffset * 1.5, 120)}px`,
            opacity: Math.min(swipeOffset / 50, 1)
          }}
        >
          <div className="flex gap-3">
            {onEdit && swipeOffset > 30 && (
              <button
                onClick={() => {
                  onEdit(cliente);
                  setSwipeOffset(0);
                }}
                className="p-2 text-primary hover:bg-primary hover:text-white rounded-full transition-colors"
                title="Editar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {onDelete && cliente.id && swipeOffset > 30 && (
              <button
                onClick={handleDeleteClick}
                className="p-2 text-danger hover:bg-danger hover:text-white rounded-full transition-colors"
                title="Excluir"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-themedark-cardbg rounded-lg shadow-lg max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-theme-headings dark:text-themedark-headings mb-2">
                  Confirmar Exclusão
                </h3>
                <p className="text-sm text-theme-bodycolor dark:text-themedark-bodycolor mb-6">
                  Tem certeza que deseja excluir o cliente <strong>{cliente.nome}</strong>? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium text-theme-headings dark:text-themedark-headings bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClienteTable({ clientes, onEdit, onDelete }: ClienteTableProps) {
  const getStatusBadge = (resultado: string) => {
    const baseClasses = "badge text-xs font-medium px-2 py-1 rounded-full";
    switch (resultado) {
      case 'Venda':
        return `${baseClasses} bg-success text-white`;
      case 'Orçamento em Processo':
        return `${baseClasses} bg-warning text-white`;
      case 'Não Venda':
        return `${baseClasses} bg-danger text-white`;
      default:
        return `${baseClasses} bg-secondary text-white`;
    }
  };

  const getQualidadeBadge = (qualidade: string) => {
    const baseClasses = "badge text-xs font-medium px-2 py-1 rounded-full";
    switch (qualidade) {
      case 'Bom':
        return `${baseClasses} bg-green-500 text-white`;
      case 'Regular':
        return `${baseClasses} bg-yellow-500 text-white`;
      case 'Ruim':
        return `${baseClasses} bg-red-500 text-white`;
      default:
        return `${baseClasses} bg-gray-500 text-white`;
    }
  };

  if (clientes.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-theme-headings dark:text-themedark-headings">
            Clientes CRM
          </h3>
        </div>
        <div className="card-body">
          <div className="text-center py-8 text-gray-500">
            Nenhum cliente encontrado
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile View - Cards */}
      <div className="block lg:hidden">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-theme-headings dark:text-themedark-headings mb-2">
            Clientes CRM
          </h3>
          <p className="text-sm text-theme-bodycolor dark:text-themedark-bodycolor">
            Deslize para a esquerda para ver as ações
          </p>
        </div>
        <div className="space-y-3">
          {clientes.map((cliente, index) => (
            <SwipeCard
              key={cliente.id || index}
              cliente={cliente}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>

      {/* Desktop View - Table */}
      <div className="hidden lg:block card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-theme-headings dark:text-themedark-headings">
            Clientes CRM
          </h3>
        </div>
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-hover">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Contato</th>
                  <th className="text-left p-3">Origem</th>
                  <th className="text-left p-3">Orçamento</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Qualidade</th>
                  <th className="text-left p-3">Valor</th>
                  <th className="text-left p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente, index) => (
                  <tr key={cliente.id || index} className="hover:bg-theme-activebg dark:hover:bg-themedark-activebg">
                    <td className="p-3 text-sm">{cliente.dataContato}</td>
                    <td className="p-3 font-medium">{cliente.nome}</td>
                    <td className="p-3 text-sm text-blue-600">{cliente.whatsappInstagram}</td>
                    <td className="p-3 text-sm">{cliente.origem}</td>
                    <td className="p-3">
                      <span className={`badge ${cliente.orcamentoEnviado === 'Sim' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} text-xs px-2 py-1 rounded`}>
                        {cliente.orcamentoEnviado}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={getStatusBadge(cliente.resultado)}>
                        {cliente.resultado}
                      </span>
                    </td>
                    <td className="p-3">
                      {cliente.qualidadeContato && (
                        <span className={getQualidadeBadge(cliente.qualidadeContato)}>
                          {cliente.qualidadeContato}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-green-600">
                      {cliente.valorFechado || '-'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(cliente)}
                            className="p-1 text-primary hover:bg-primary hover:text-white rounded transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {onDelete && cliente.id && (
                          <button
                            onClick={() => onDelete(cliente.id!)}
                            className="p-1 text-danger hover:bg-danger hover:text-white rounded transition-colors"
                            title="Excluir"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}