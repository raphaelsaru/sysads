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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const isValidTap = useRef(true);

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

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(false);
    startX.current = e.clientX;
    startY.current = e.clientY;
    currentX.current = startX.current;
    currentY.current = startY.current;
    isValidTap.current = true;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    currentX.current = e.clientX;
    currentY.current = e.clientY;

    const moveX = startX.current - currentX.current;
    const moveY = Math.abs(startY.current - currentY.current);
    const diffX = Math.abs(moveX);

    // Se moveu mais de 10px verticalmente, não é um tap válido
    if (moveY > 10) {
      isValidTap.current = false;
      return;
    }

    // Se moveu mais de 10px horizontalmente, considera como dragging
    if (diffX > 10) {
      setIsDragging(true);
      e.preventDefault();
      e.stopPropagation();

      // Permite swipe para esquerda (abrir) e direita (fechar)
      if (moveX > 0) {
        // Swipe para esquerda - abre as ações
        setSwipeOffset(Math.min(moveX, 80));
      } else if (moveX < 0 && swipeOffset > 0) {
        // Swipe para direita - fecha as ações (só se já estiver aberto)
        setSwipeOffset(Math.max(0, swipeOffset + moveX));
      }
    } else {
      // Mesmo para movimentos pequenos, previne o scroll horizontal
      if (diffX > 2) {
        e.preventDefault();
      }
    }
  };

  const handlePointerUp = () => {
    const wasDragging = isDragging;
    const finalOffset = swipeOffset;
    const validTap = isValidTap.current;
    setIsDragging(false);

    // Se swipou mais de 40px para esquerda, mantém aberto
    // Se swipou para direita ou menos de 40px, fecha
    if (swipeOffset > 40) {
      setSwipeOffset(80);
    } else {
      setSwipeOffset(0);
    }

    // Só abre modal se foi um tap válido (não arrastou e movimento vertical < 10px)
    if (!wasDragging && finalOffset === 0 && validTap) {
      setShowDetailsModal(true);
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

  return (
    <div
      ref={cardRef}
      className="relative bg-white dark:bg-themedark-cardbg rounded-lg shadow-sm border border-theme-border dark:border-themedark-border mb-3"
    >
      {/* Card Content - sempre fixo */}
      <div
        className="relative bg-white dark:bg-themedark-cardbg p-4 rounded-lg cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          touchAction: 'pan-y',
          overflowX: 'hidden',
          position: 'relative'
        }}
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
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-50 dark:bg-red-900 transition-all duration-200 rounded-r-lg"
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

      {/* Modal de Detalhes do Cliente */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-themedark-cardbg rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-themedark-cardbg border-b border-theme-border dark:border-themedark-border p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-theme-headings dark:text-themedark-headings">
                  Detalhes do Cliente
                </h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-1 text-theme-bodycolor dark:text-themedark-bodycolor hover:text-theme-headings dark:hover:text-themedark-headings"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Nome */}
              <div>
                <label className="text-sm font-medium text-theme-bodycolor dark:text-themedark-bodycolor">Nome</label>
                <p className="text-theme-headings dark:text-themedark-headings font-medium">{cliente.nome}</p>
              </div>

              {/* Data de Contato */}
              <div>
                <label className="text-sm font-medium text-theme-bodycolor dark:text-themedark-bodycolor">Data de Contato</label>
                <p className="text-theme-headings dark:text-themedark-headings">{cliente.dataContato}</p>
              </div>

              {/* Contato */}
              <div>
                <label className="text-sm font-medium text-theme-bodycolor dark:text-themedark-bodycolor">WhatsApp / Instagram</label>
                <p className="text-theme-headings dark:text-themedark-headings text-blue-600">{cliente.whatsappInstagram}</p>
              </div>

              {/* Origem */}
              <div>
                <label className="text-sm font-medium text-theme-bodycolor dark:text-themedark-bodycolor">Origem</label>
                <p className="text-theme-headings dark:text-themedark-headings">{cliente.origem}</p>
              </div>

              {/* Orçamento Enviado */}
              <div>
                <label className="text-sm font-medium text-theme-bodycolor dark:text-themedark-bodycolor">Orçamento Enviado</label>
                <div className="mt-1">
                  <span className={`badge ${cliente.orcamentoEnviado === 'Sim' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} text-xs px-2 py-1 rounded`}>
                    {cliente.orcamentoEnviado}
                  </span>
                </div>
              </div>

              {/* Status/Resultado */}
              <div>
                <label className="text-sm font-medium text-theme-bodycolor dark:text-themedark-bodycolor">Status</label>
                <div className="mt-1">
                  <span className={getStatusBadge(cliente.resultado)}>
                    {cliente.resultado}
                  </span>
                </div>
              </div>

              {/* Qualidade do Contato */}
              {cliente.qualidadeContato && (
                <div>
                  <label className="text-sm font-medium text-theme-bodycolor dark:text-themedark-bodycolor">Qualidade do Contato</label>
                  <div className="mt-1">
                    <span className={getQualidadeBadge(cliente.qualidadeContato)}>
                      {cliente.qualidadeContato}
                    </span>
                  </div>
                </div>
              )}

              {/* Valor Fechado */}
              {cliente.valorFechado && (
                <div>
                  <label className="text-sm font-medium text-theme-bodycolor dark:text-themedark-bodycolor">Valor Fechado</label>
                  <p className="text-theme-headings dark:text-themedark-headings font-bold text-success text-lg">{cliente.valorFechado}</p>
                </div>
              )}

              {/* Observações */}
              {cliente.observacao && (
                <div>
                  <label className="text-sm font-medium text-theme-bodycolor dark:text-themedark-bodycolor">Observações</label>
                  <p className="text-theme-headings dark:text-themedark-headings text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded-md mt-1">{cliente.observacao}</p>
                </div>
              )}
            </div>

            {/* Botões de Ação */}
            <div className="sticky bottom-0 bg-white dark:bg-themedark-cardbg border-t border-theme-border dark:border-themedark-border p-4 rounded-b-lg">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    if (onEdit) onEdit(cliente);
                  }}
                  className="flex-1 btn btn-primary flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Editar
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 text-sm font-medium text-theme-headings dark:text-themedark-headings bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Fechar
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null);

  const handleDeleteClick = (cliente: Cliente) => {
    setClienteParaExcluir(cliente);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (onDelete && clienteParaExcluir?.id) {
      onDelete(clienteParaExcluir.id);
    }
    setShowDeleteModal(false);
    setClienteParaExcluir(null);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setClienteParaExcluir(null);
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
        <div className="space-y-3" style={{ overflowX: 'hidden' }}>
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
                            onClick={() => handleDeleteClick(cliente)}
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

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && clienteParaExcluir && (
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
                  Tem certeza que deseja excluir o cliente <strong>{clienteParaExcluir.nome}</strong>? Esta ação não pode ser desfeita.
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
    </>
  );
}