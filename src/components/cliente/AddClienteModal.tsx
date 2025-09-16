'use client';

import { useState } from 'react';
import { NovoCliente } from '@/types/cliente';

interface AddClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cliente: NovoCliente) => void;
}

export default function AddClienteModal({ isOpen, onClose, onSave }: AddClienteModalProps) {
  const [formData, setFormData] = useState<NovoCliente>({
    nome: '',
    telefone: '',
    email: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    dataContrato: '',
    valorContrato: undefined,
    status: 'pendente',
    observacoes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'valorContrato' ? (value ? Number(value) : undefined) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay
      onSave(formData);

      // Reset form
      setFormData({
        nome: '',
        telefone: '',
        email: '',
        endereco: '',
        cidade: '',
        estado: '',
        cep: '',
        dataContrato: '',
        valorContrato: undefined,
        status: 'pendente',
        observacoes: '',
      });

      onClose();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      nome: '',
      telefone: '',
      email: '',
      endereco: '',
      cidade: '',
      estado: '',
      cep: '',
      dataContrato: '',
      valorContrato: undefined,
      status: 'pendente',
      observacoes: '',
    });
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
              Novo Cliente
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
            {/* Informações Básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="nome" className="form-label">
                  Nome Completo *
                </label>
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  required
                  className="form-control"
                  value={formData.nome}
                  onChange={handleInputChange}
                  placeholder="Digite o nome completo"
                />
              </div>

              <div>
                <label htmlFor="telefone" className="form-label">
                  Telefone *
                </label>
                <input
                  id="telefone"
                  name="telefone"
                  type="tel"
                  required
                  className="form-control"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="form-label">
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="form-control"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="cliente@email.com"
              />
            </div>

            {/* Endereço */}
            <div>
              <label htmlFor="endereco" className="form-label">
                Endereço *
              </label>
              <input
                id="endereco"
                name="endereco"
                type="text"
                required
                className="form-control"
                value={formData.endereco}
                onChange={handleInputChange}
                placeholder="Rua, número, bairro"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="cidade" className="form-label">
                  Cidade *
                </label>
                <input
                  id="cidade"
                  name="cidade"
                  type="text"
                  required
                  className="form-control"
                  value={formData.cidade}
                  onChange={handleInputChange}
                  placeholder="São Paulo"
                />
              </div>

              <div>
                <label htmlFor="estado" className="form-label">
                  Estado *
                </label>
                <select
                  id="estado"
                  name="estado"
                  required
                  className="form-control"
                  value={formData.estado}
                  onChange={handleInputChange}
                >
                  <option value="">Selecione</option>
                  <option value="AC">Acre</option>
                  <option value="AL">Alagoas</option>
                  <option value="AP">Amapá</option>
                  <option value="AM">Amazonas</option>
                  <option value="BA">Bahia</option>
                  <option value="CE">Ceará</option>
                  <option value="DF">Distrito Federal</option>
                  <option value="ES">Espírito Santo</option>
                  <option value="GO">Goiás</option>
                  <option value="MA">Maranhão</option>
                  <option value="MT">Mato Grosso</option>
                  <option value="MS">Mato Grosso do Sul</option>
                  <option value="MG">Minas Gerais</option>
                  <option value="PA">Pará</option>
                  <option value="PB">Paraíba</option>
                  <option value="PR">Paraná</option>
                  <option value="PE">Pernambuco</option>
                  <option value="PI">Piauí</option>
                  <option value="RJ">Rio de Janeiro</option>
                  <option value="RN">Rio Grande do Norte</option>
                  <option value="RS">Rio Grande do Sul</option>
                  <option value="RO">Rondônia</option>
                  <option value="RR">Roraima</option>
                  <option value="SC">Santa Catarina</option>
                  <option value="SP">São Paulo</option>
                  <option value="SE">Sergipe</option>
                  <option value="TO">Tocantins</option>
                </select>
              </div>

              <div>
                <label htmlFor="cep" className="form-label">
                  CEP *
                </label>
                <input
                  id="cep"
                  name="cep"
                  type="text"
                  required
                  className="form-control"
                  value={formData.cep}
                  onChange={handleInputChange}
                  placeholder="12345-678"
                />
              </div>
            </div>

            {/* Informações do Contrato */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="form-label">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  className="form-control"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="pendente">Pendente</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              <div>
                <label htmlFor="dataContrato" className="form-label">
                  Data do Contrato
                </label>
                <input
                  id="dataContrato"
                  name="dataContrato"
                  type="date"
                  className="form-control"
                  value={formData.dataContrato}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="valorContrato" className="form-label">
                Valor do Contrato (R$)
              </label>
              <input
                id="valorContrato"
                name="valorContrato"
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={formData.valorContrato || ''}
                onChange={handleInputChange}
                placeholder="0,00"
              />
            </div>

            <div>
              <label htmlFor="observacoes" className="form-label">
                Observações
              </label>
              <textarea
                id="observacoes"
                name="observacoes"
                rows={3}
                className="form-control"
                value={formData.observacoes}
                onChange={handleInputChange}
                placeholder="Informações adicionais sobre o cliente..."
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
                  Salvar Cliente
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}