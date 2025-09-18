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

// Pula os primeiros 10 que já foram inseridos
const remainingClients = clients.slice(10);

// Cria uma mega migração com todos os dados restantes
let megaSQL = `-- Migração completa dos leads restantes (${remainingClients.length} registros)\n`;
megaSQL += '-- Dados importados do arquivo CSV leads-ac-tattoo.csv\n\n';

// Divide em lotes de 50 para melhor legibilidade do SQL
const batchSize = 50;
for (let i = 0; i < remainingClients.length; i += batchSize) {
  const batch = remainingClients.slice(i, i + batchSize);
  const batchNum = Math.floor(i / batchSize) + 1;

  megaSQL += `-- Lote ${batchNum} (registros ${i + 11} a ${i + batch.length + 10})\n`;
  megaSQL += 'INSERT INTO clientes (user_id, data_contato, nome, whatsapp_instagram, origem, orcamento_enviado, resultado, qualidade_contato, valor_fechado, observacao) VALUES\n';

  const values = batch.map(client => {
    return `(${escapeSQLString(client.user_id)}, ${escapeSQLString(client.data_contato)}, ${escapeSQLString(client.nome)}, ${escapeSQLString(client.whatsapp_instagram)}, ${escapeSQLString(client.origem)}, ${client.orcamento_enviado}, ${escapeSQLString(client.resultado)}, ${escapeSQLString(client.qualidade_contato)}, ${client.valor_fechado || 'NULL'}, ${escapeSQLString(client.observacao)})`;
  });

  megaSQL += values.join(',\n');
  megaSQL += ';\n\n';
}

// Adiciona verificação final
megaSQL += `-- Verificação: deve retornar ${clients.length} registros total\n`;
megaSQL += `SELECT COUNT(*) as total_clientes FROM clientes WHERE user_id = '4039e82a-f72b-4caa-afcf-57e141527e4d';\n`;

// Salva a mega migração
const megaPath = path.join(__dirname, '../docs/mega-migration-leads.sql');
fs.writeFileSync(megaPath, megaSQL);

console.log(`Mega migração criada com ${remainingClients.length} registros restantes`);
console.log(`Arquivo salvo em: ${megaPath}`);
console.log(`\nResumo:`);
console.log(`- Total de registros no CSV: ${clients.length}`);
console.log(`- Já inseridos: 10`);
console.log(`- Restantes para inserir: ${remainingClients.length}`);
console.log(`- Lotes de ${batchSize} registros: ${Math.ceil(remainingClients.length / batchSize)}`);