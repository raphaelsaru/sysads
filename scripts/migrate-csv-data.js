const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://bjtjyzdbewxoypjaphqs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqdGp5emRiZXd4b3lwamFwaHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4Nzc2MDQsImV4cCI6MjA3MzQ1MzYwNH0.HU3K4Ynj5k8i7Dmmi-C7acFq28Sl3ksezlHai2TXOUg';
const supabase = createClient(supabaseUrl, supabaseKey);

const USER_ID = '4039e82a-f72b-4caa-afcf-57e141527e4d';

// Função para converter data do formato DD/MM para YYYY-MM-DD
function convertDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  const [day, month] = dateStr.split('/');
  // Assumindo ano 2024 baseado no contexto do arquivo
  const year = '2024';

  const paddedDay = day.padStart(2, '0');
  const paddedMonth = month.padStart(2, '0');

  return `${year}-${paddedMonth}-${paddedDay}`;
}

// Função para converter valor monetário
function convertValue(valueStr) {
  if (!valueStr || valueStr.trim() === '') return null;

  // Remove símbolos monetários e espaços
  let cleanValue = valueStr.replace(/[$R\s]/g, '');

  // Converte vírgulas para pontos
  cleanValue = cleanValue.replace(',', '.');

  // Remove pontos de milhares (pontos seguidos de 3 dígitos)
  cleanValue = cleanValue.replace(/\.(?=\d{3}(?:\.|$))/g, '');

  const numValue = parseFloat(cleanValue);
  return isNaN(numValue) ? null : numValue;
}

// Função para mapear origem
function mapOrigem(origem) {
  const origemMap = {
    'Anúncio Promoção': 'Anúncio',
    'Anúncio Geral': 'Anúncio',
    'Orgânico / Pefil': 'Orgânico / Perfil',
    'Cliente antigo': 'Cliente antigo',
    'Indicação': 'Indicação'
  };

  return origemMap[origem] || 'Anúncio';
}

// Função para mapear resultado
function mapResultado(resultado) {
  if (!resultado || resultado.trim() === '') return 'Orçamento em Processo';

  const resultadoMap = {
    'Venda': 'Venda',
    'Orçamento em Processo': 'Orçamento em Processo',
    'Não Venda': 'Não Venda'
  };

  return resultadoMap[resultado] || 'Orçamento em Processo';
}

// Função para mapear qualidade do contato
function mapQualidadeContato(qualidade) {
  if (!qualidade || qualidade.trim() === '') return null;

  const qualidadeMap = {
    'Bom': 'Bom',
    'Regular': 'Regular',
    'Ruim': 'Ruim'
  };

  return qualidadeMap[qualidade] || null;
}

async function migrateData() {
  try {
    // Lê o arquivo CSV
    const csvPath = path.join(__dirname, '../docs/leads-ac-tattoo.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');

    // Divide em linhas e remove a primeira linha (cabeçalho)
    const lines = csvContent.split('\n').slice(1);

    const clientsToInsert = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV considerando vírgulas dentro de aspas
      const columns = [];
      let currentColumn = '';
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          columns.push(currentColumn.trim());
          currentColumn = '';
        } else {
          currentColumn += char;
        }
      }
      columns.push(currentColumn.trim());

      // Mapeia os dados
      const [
        dataContato,
        nome,
        whatsappInstagram,
        origem,
        orcamentoEnviado,
        resultado,
        qualidadeContato,
        valorFechado,
        observacao
      ] = columns;

      // Skip linhas vazias ou com dados insuficientes
      if (!dataContato && !nome) continue;

      const client = {
        user_id: USER_ID,
        data_contato: convertDate(dataContato),
        nome: nome || 'Nome não informado',
        whatsapp_instagram: whatsappInstagram || null,
        origem: mapOrigem(origem),
        orcamento_enviado: orcamentoEnviado === 'Sim',
        resultado: mapResultado(resultado),
        qualidade_contato: mapQualidadeContato(qualidadeContato),
        valor_fechado: convertValue(valorFechado),
        observacao: observacao || null
      };

      clientsToInsert.push(client);
    }

    console.log(`Processados ${clientsToInsert.length} registros`);

    // Insere os dados em lotes de 100
    const batchSize = 100;
    for (let i = 0; i < clientsToInsert.length; i += batchSize) {
      const batch = clientsToInsert.slice(i, i + batchSize);

      const { data, error } = await supabase
        .from('clientes')
        .insert(batch);

      if (error) {
        console.error(`Erro no lote ${Math.floor(i / batchSize) + 1}:`, error);
        break;
      }

      console.log(`Lote ${Math.floor(i / batchSize) + 1} inserido com sucesso (${batch.length} registros)`);
    }

    console.log('Migração concluída!');

  } catch (error) {
    console.error('Erro durante a migração:', error);
  }
}

// Executa a migração
migrateData();