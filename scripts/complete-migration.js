const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Configuração do Supabase usando variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.USER_ID;

// Validação das variáveis de ambiente
if (!supabaseUrl || !supabaseKey || !USER_ID) {
  console.error('❌ Erro: Variáveis de ambiente não encontradas!');
  console.error('Certifique-se de que o arquivo .env.local contém:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  console.error('- USER_ID');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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