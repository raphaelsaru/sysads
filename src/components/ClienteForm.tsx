'use client';

import { useState } from 'react';
import { NovoCliente, Cliente } from '@/types/crm';

interface ClienteFormProps {
  onSubmit: (cliente: NovoCliente) => void;
  onCancel?: () => void;
  cliente?: Cliente;
  isEditing?: boolean;
}

export default function ClienteForm({ onSubmit, onCancel, cliente, isEditing = false }: ClienteFormProps) {
  const [formData, setFormData] = useState<NovoCliente>({
    dataContato: cliente?.dataContato || '',
    nome: cliente?.nome || '',
    whatsappInstagram: cliente?.whatsappInstagram || '',
    origem: cliente?.origem || 'Orgânico / Pefil',
    orcamentoEnviado: cliente?.orcamentoEnviado || 'Não',
    resultado: cliente?.resultado || 'Orçamento em Processo',
    qualidadeContato: cliente?.qualidadeContato || 'Regular',
    valorFechado: cliente?.valorFechado || '',
    observacao: cliente?.observacao || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-theme-headings dark:text-themedark-headings">
          {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
        </h3>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Data de Contato</label>
              <input
                type="text"
                name="dataContato"
                value={formData.dataContato}
                onChange={handleChange}
                className="form-control"
                placeholder="DD/MM"
                required
              />
            </div>

            <div>
              <label className="form-label">Nome do Cliente</label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                className="form-control"
                placeholder="Nome completo"
                required
              />
            </div>

            <div>
              <label className="form-label">WhatsApp / Instagram</label>
              <input
                type="text"
                name="whatsappInstagram"
                value={formData.whatsappInstagram}
                onChange={handleChange}
                className="form-control"
                placeholder="@usuario ou telefone"
                required
              />
            </div>

            <div>
              <label className="form-label">Origem</label>
              <select
                name="origem"
                value={formData.origem}
                onChange={handleChange}
                className="form-control"
                required
              >
                <option value="Indicação">Indicação</option>
                <option value="Orgânico / Pefil">Orgânico / Pefil</option>
                <option value="Anúncio">Anúncio</option>
                <option value="Cliente antigo">Cliente antigo</option>
              </select>
            </div>

            <div>
              <label className="form-label">Orçamento Enviado</label>
              <select
                name="orcamentoEnviado"
                value={formData.orcamentoEnviado}
                onChange={handleChange}
                className="form-control"
                required
              >
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>

            <div>
              <label className="form-label">Resultado</label>
              <select
                name="resultado"
                value={formData.resultado}
                onChange={handleChange}
                className="form-control"
                required
              >
                <option value="Venda">Venda</option>
                <option value="Orçamento em Processo">Orçamento em Processo</option>
                <option value="Não Venda">Não Venda</option>
              </select>
            </div>

            <div>
              <label className="form-label">Qualidade do Contato</label>
              <select
                name="qualidadeContato"
                value={formData.qualidadeContato}
                onChange={handleChange}
                className="form-control"
                required
              >
                <option value="Bom">Bom</option>
                <option value="Regular">Regular</option>
                <option value="Ruim">Ruim</option>
              </select>
            </div>

            <div>
              <label className="form-label">Valor Fechado</label>
              <input
                type="text"
                name="valorFechado"
                value={formData.valorFechado}
                onChange={handleChange}
                className="form-control"
                placeholder="R$ 1.000,00"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Observações</label>
            <textarea
              name="observacao"
              value={formData.observacao}
              onChange={handleChange}
              className="form-control"
              rows={3}
              placeholder="Observações sobre o cliente ou atendimento"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="btn btn-primary px-6 py-2"
            >
              {isEditing ? 'Atualizar Cliente' : 'Adicionar Cliente'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary px-6 py-2"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}