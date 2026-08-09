#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Janes Streaming - Setup & Run Script
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "🎬 Janes Streaming - Setup"
echo "═══════════════════════════"
echo ""

# Check for .env.local
if [ ! -f .env.local ]; then
  if [ -f .env.example ]; then
    echo "📋 Criando .env.local a partir do .env.example..."
    cp .env.example .env.local
    echo "⚠️  Edite .env.local e configure suas variáveis (especialmente OMDB_API_KEY)"
    echo ""
  else
    echo "⚠️  Nenhum .env.example encontrado. Crie .env.local manualmente."
    echo ""
  fi
fi

# Check for OMDB_API_KEY
if grep -q "your_omdb_api_key_here" .env.local 2>/dev/null; then
  echo "🔑 OMDb API Key não configurada!"
  echo "   Obtenha sua chave gratuita em: https://www.omdbapi.com/apikey.aspx"
  echo "   Depois, edite .env.local e substitua 'your_omdb_api_key_here' pela sua chave."
  echo ""
fi

# Install dependencies
if [ ! -d node_modules ]; then
  echo "📦 Instalando dependências..."
  npm install
  echo ""
fi

# Run migrations
echo "🗄️  Executando migrações do banco de dados..."
npx tsx src/db/migrate.js 2>/dev/null || echo "   (migrações já aplicadas ou DB não inicializado)"
echo ""

# Generate auth secret if needed
echo "🔐 Verificando segredo de autenticação..."
node scripts/ensure-auth-secret.cjs 2>/dev/null || true
echo ""

# Start dev server
echo "🚀 Iniciando Janes Streaming..."
echo "   Acesse: http://localhost:4321"
echo ""
npm run dev
