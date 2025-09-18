const fs = require('fs');
const path = require('path');

// Lê os dados processados
const clientsPath = path.join(__dirname, '../docs/processed-leads.json');
const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));

// Função para escapar strings SQL
function escapeSQLString(str) {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str === 'boolean') return str ? 'true' : 'false';
  if (typeof str === 'number') return str.toString();

  // Escapa aspas simples e barras invertidas
  return "'" + str.toString().replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
}

// Gera SQL para um lote
function generateBatchSQL(batch, batchNum) {
  let sql = `-- Lote ${batchNum} (${batch.length} registros)\n`;
  sql += 'INSERT INTO clientes (user_id, data_contato, nome, whatsapp_instagram, origem, orcamento_enviado, resultado, qualidade_contato, valor_fechado, observacao) VALUES\n';

  const values = batch.map(client => {
    return `(${escapeSQLString(client.user_id)}, ${escapeSQLString(client.data_contato)}, ${escapeSQLString(client.nome)}, ${escapeSQLString(client.whatsapp_instagram)}, ${escapeSQLString(client.origem)}, ${client.orcamento_enviado}, ${escapeSQLString(client.resultado)}, ${escapeSQLString(client.qualidade_contato)}, ${client.valor_fechado || 'NULL'}, ${escapeSQLString(client.observacao)})`;
  });

  sql += values.join(',\n');
  sql += ';';

  return sql;
}

// Pula os primeiros 10 que já foram inseridos
const remainingClients = clients.slice(10);
const batchSize = 20;

console.log(`Total de registros: ${clients.length}`);
console.log(`Já inseridos: 10`);
console.log(`Restantes: ${remainingClients.length}`);
console.log(`Lotes de ${batchSize} registros: ${Math.ceil(remainingClients.length / batchSize)}`);

// Gera arquivos SQL para cada lote
const batchesDir = path.join(__dirname, '../docs/batches');
if (!fs.existsSync(batchesDir)) {
  fs.mkdirSync(batchesDir, { recursive: true });
}

for (let i = 0; i < remainingClients.length; i += batchSize) {
  const batch = remainingClients.slice(i, i + batchSize);
  const batchNum = Math.floor(i / batchSize) + 2; // +2 porque já temos o lote 1

  const batchSQL = generateBatchSQL(batch, batchNum);
  const batchPath = path.join(batchesDir, `batch-${batchNum}.sql`);

  fs.writeFileSync(batchPath, batchSQL);
  console.log(`Lote ${batchNum} salvo: ${batch.length} registros`);
}

console.log('\nTodos os lotes foram gerados na pasta docs/batches/');
console.log('Você pode agora executar cada lote manualmente ou usar outro script para automatizar.');