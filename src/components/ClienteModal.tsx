'use client';

import { useState, useEffect } from 'react';
import { NovoCliente, Cliente } from '@/types/crm';
import MoneyInput from './MoneyInput';
import { getTodayBR, formatDateISO } from '@/lib/dateUtils';

interface ClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cliente: NovoCliente) => void;
  cliente?: Cliente;
}

export default function ClienteModal({ isOpen, onClose, onSave, cliente }: ClienteModalProps) {

  const [formData, setFormData] = useState<NovoCliente>({
    dataContato: getTodayBR(),
    nome: '',
    whatsappInstagram: '',
    origem: 'Orgânico / Pefil',
    orcamentoEnviado: 'Não',
    resultado: 'Orçamento em Processo',
    qualidadeContato: 'Regular',
    valorFechado: '',
    observacao: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (cliente) {
      setFormData({
        dataContato: cliente.dataContato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsappInstagram,
        origem: cliente.origem,
        orcamentoEnviado: cliente.orcamentoEnviado,
        resultado: cliente.resultado,
        qualidadeContato: cliente.qualidadeContato,
        valorFechado: cliente.valorFechado || '',
        observacao: cliente.observacao || '',
      });

      // Extrair valor numérico do valor formatado para o MoneyInput
      if (cliente.valorFechado) {
        const numeroLimpo = cliente.valorFechado.replace(/[^\d,]/g, '').replace(',', '.');
        setValorNumerico(parseFloat(numeroLimpo) || undefined);
      } else {
        setValorNumerico(undefined);
      }
    } else {
      setFormData({
        dataContato: getTodayBR(),
        nome: '',
        whatsappInstagram: '',
        origem: 'Orgânico / Pefil',
        orcamentoEnviado: 'Não',
        resultado: 'Orçamento em Processo',
        qualidadeContato: 'Regular',
        valorFechado: '',
        observacao: '',
      });
      setValorNumerico(undefined);
    }
  }, [cliente, isOpen]);

  const [valorNumerico, setValorNumerico] = useState<number | undefined>();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleValorChange = (valor: number | undefined) => {
    setValorNumerico(valor);
    // Converte o valor numérico para string formatada para armazenar no formData
    const valorFormatado = valor ? `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
    setFormData(prev => ({
      ...prev,
      valorFechado: valorFormatado
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay

      // Converte a data para formato ISO antes de enviar
      const dataParaEnvio = {
        ...formData,
        dataContato: formatDateISO(formData.dataContato)
      };

      onSave(dataParaEnvio);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      dataContato: getTodayBR(),
      nome: '',
      whatsappInstagram: '',
      origem: 'Orgânico / Pefil',
      orcamentoEnviado: 'Não',
      resultado: 'Orçamento em Processo',
      qualidadeContato: 'Regular',
      valorFechado: '',
      observacao: '',
    });
    setValorNumerico(undefined);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={handleCancel}></div>
      <div className="modal-content">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3 className="text-xl font-semibold text-theme-headings dark:text-themedark-headings">
              {cliente ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 text-theme-bodycolor dark:text-themedark-bodycolor hover:text-theme-headings dark:hover:text-themedark-headings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="modal-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dataContato" className="form-label">
                  Data de Contato *
                </label>
                <input
                  id="dataContato"
                  name="dataContato"
                  type="date"
                  required
                  className="form-control"
                  value={formatDateISO(formData.dataContato)}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label htmlFor="nome" className="form-label">
                  Nome do Cliente *
                </label>
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  required
                  className="form-control"
                  value={formData.nome}
                  onChange={handleInputChange}
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label htmlFor="whatsappInstagram" className="form-label">
                  WhatsApp / Instagram *
                </label>
                <input
                  id="whatsappInstagram"
                  name="whatsappInstagram"
                  type="text"
                  required
                  className="form-control"
                  value={formData.whatsappInstagram}
                  onChange={handleInputChange}
                  placeholder="@usuario ou telefone"
                />
              </div>

              <div>
                <label htmlFor="origem" className="form-label">
                  Origem *
                </label>
                <select
                  id="origem"
                  name="origem"
                  required
                  className="form-control"
                  value={formData.origem}
                  onChange={handleInputChange}
                >
                  <option value="Indicação">Indicação</option>
                  <option value="Orgânico / Pefil">Orgânico / Pefil</option>
                  <option value="Anúncio">Anúncio</option>
                  <option value="Cliente antigo">Cliente antigo</option>
                </select>
              </div>

              <div>
                <label htmlFor="orcamentoEnviado" className="form-label">
                  Orçamento Enviado *
                </label>
                <div className="flex items-center mt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      id="orcamentoEnviado"
                      name="orcamentoEnviado"
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.orcamentoEnviado === 'Sim'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        orcamentoEnviado: e.target.checked ? 'Sim' : 'Não'
                      }))}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    <span className="ml-3 text-sm font-medium text-theme-headings dark:text-themedark-headings">
                      {formData.orcamentoEnviado === 'Sim' ? 'Sim' : 'Não'}
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="resultado" className="form-label">
                  Resultado *
                </label>
                <select
                  id="resultado"
                  name="resultado"
                  required
                  className="form-control"
                  value={formData.resultado}
                  onChange={handleInputChange}
                >
                  <option value="Venda">Venda</option>
                  <option value="Orçamento em Processo">Orçamento em Processo</option>
                  <option value="Não Venda">Não Venda</option>
                </select>
              </div>

              <div>
                <label htmlFor="qualidadeContato" className="form-label">
                  Qualidade do Contato *
                </label>
                <select
                  id="qualidadeContato"
                  name="qualidadeContato"
                  required
                  className="form-control"
                  value={formData.qualidadeContato}
                  onChange={handleInputChange}
                >
                  <option value="Bom">Bom</option>
                  <option value="Regular">Regular</option>
                  <option value="Ruim">Ruim</option>
                </select>
              </div>

              <div>
                <label htmlFor="valorFechado" className="form-label">
                  Valor Fechado
                </label>
                <MoneyInput
                  id="valorFechado"
                  name="valorFechado"
                  className="form-control"
                  value={valorNumerico}
                  onChangeValue={handleValorChange}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            <div>
              <label htmlFor="observacao" className="form-label">
                Observações
              </label>
              <textarea
                id="observacao"
                name="observacao"
                rows={3}
                className="form-control"
                value={formData.observacao}
                onChange={handleInputChange}
                placeholder="Observações sobre o cliente ou atendimento"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {cliente ? 'Atualizar Cliente' : 'Salvar Cliente'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}