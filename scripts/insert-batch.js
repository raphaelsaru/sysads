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

// Gera SQL para um lote pequeno
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

// Salva o primeiro lote para teste
const firstBatch = clients.slice(0, 10);
const firstBatchSQL = generateBatchSQL(firstBatch, 1);

console.log('Primeiro lote:');
console.log(firstBatchSQL);
console.log(`\nTotal de registros: ${clients.length}`);
console.log(`Lotes necessários (10 por lote): ${Math.ceil(clients.length / 10)}`);

// Salva o primeiro lote em arquivo
const batchPath = path.join(__dirname, '../docs/batch-1.sql');
fs.writeFileSync(batchPath, firstBatchSQL);
console.log(`Primeiro lote salvo em: ${batchPath}`);