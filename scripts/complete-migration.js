const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = 'https://bjtjyzdbewxoypjaphqs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqdGp5emRiZXd4b3lwamFwaHFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzg3NzYwNCwiZXhwIjoyMDczNDUzNjA0fQ.OaW7lAZ7P1PmQJD0sQhQD4Nx7z8n6QEQFsWCfVkSCSU'; // Service role key
const supabase = createClient(supabaseUrl, supabaseKey);

const USER_ID = '4039e82a-f72b-4caa-afcf-57e141527e4d';

async function completeMigration() {
  try {
    // Lê todos os dados processados
    const clientsPath = path.join(__dirname, '../docs/processed-leads.json');
    const allClients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));

    console.log(`Total de registros no arquivo: ${allClients.length}`);

    // Verifica quantos já estão no banco
    const { count, error: countError } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', USER_ID);

    if (countError) {
      console.error('Erro ao contar registros:', countError);
      return;
    }

    console.log(`Registros já no banco: ${count}`);
    console.log(`Registros restantes: ${allClients.length - count}`);

    if (count >= allClients.length) {
      console.log('Todos os registros já foram importados!');
      return;
    }

    // Pega os registros que ainda não foram inseridos
    const remainingClients = allClients.slice(count);

    console.log(`Inserindo ${remainingClients.length} registros restantes...`);

    // Insere em lotes de 100
    const batchSize = 100;
    for (let i = 0; i < remainingClients.length; i += batchSize) {
      const batch = remainingClients.slice(i, i + batchSize);

      console.log(`Inserindo lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(remainingClients.length / batchSize)} (${batch.length} registros)...`);

      // Prepara os dados para inserção
      const insertData = batch.map(client => ({
        user_id: client.user_id,
        data_contato: client.data_contato,
        nome: client.nome,
        whatsapp_instagram: client.whatsapp_instagram,
        origem: client.origem,
        orcamento_enviado: client.orcamento_enviado,
        resultado: client.resultado,
        qualidade_contato: client.qualidade_contato,
        valor_fechado: client.valor_fechado,
        observacao: client.observacao
      }));

      const { error } = await supabase
        .from('clientes')
        .insert(insertData);

      if (error) {
        console.error(`Erro no lote ${Math.floor(i / batchSize) + 1}:`, error);
        break;
      }

      console.log(`✓ Lote ${Math.floor(i / batchSize) + 1} inserido com sucesso`);
    }

    // Verifica o total final
    const { count: finalCount } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', USER_ID);

    console.log(`\n🎉 Migração concluída!`);
    console.log(`Total de registros importados: ${finalCount}/${allClients.length}`);

  } catch (error) {
    console.error('Erro durante a migração:', error);
  }
}

// Executa a migração
completeMigration();