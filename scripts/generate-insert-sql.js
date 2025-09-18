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

// Gera o SQL INSERT
function generateInsertSQL(clients) {
  const batchSize = 50; // Inserir em lotes de 50
  let sql = '';

  for (let i = 0; i < clients.length; i += batchSize) {
    const batch = clients.slice(i, i + batchSize);

    sql += `-- Lote ${Math.floor(i / batchSize) + 1}\n`;
    sql += 'INSERT INTO clientes (user_id, data_contato, nome, whatsapp_instagram, origem, orcamento_enviado, resultado, qualidade_contato, valor_fechado, observacao) VALUES\n';

    const values = batch.map(client => {
      return `(${escapeSQLString(client.user_id)}, ${escapeSQLString(client.data_contato)}, ${escapeSQLString(client.nome)}, ${escapeSQLString(client.whatsapp_instagram)}, ${escapeSQLString(client.origem)}, ${client.orcamento_enviado}, ${escapeSQLString(client.resultado)}, ${escapeSQLString(client.qualidade_contato)}, ${client.valor_fechado || 'NULL'}, ${escapeSQLString(client.observacao)})`;
    });

    sql += values.join(',\n');
    sql += ';\n\n';
  }

  return sql;
}

const insertSQL = generateInsertSQL(clients);

// Salva o SQL
const sqlPath = path.join(__dirname, '../docs/insert-leads.sql');
fs.writeFileSync(sqlPath, insertSQL);

console.log(`SQL gerado com ${clients.length} registros`);
console.log(`Arquivo salvo em: ${sqlPath}`);