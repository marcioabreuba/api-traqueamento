const { execSync } = require('child_process');
const path = require('path');

try {
  // Gera o cliente Prisma
  console.log('Gerando cliente Prisma...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Executa as migrações
  console.log('Executando migrações...');
  execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });

  console.log('Migrações concluídas com sucesso!');
} catch (error) {
  console.error('Erro ao executar migrações:', error);
  process.exit(1);
} 