# 🎬 Janes Streaming

**Seu cinema pessoal** — descubra e assista filmes diretamente no app.

Janes Streaming é um aplicativo pessoal de filmes inspirado na experiência de apps como YouCine e SmartPlay. Descubra filmes com interface de swipe, veja detalhes completos com dados da OMDb API, e assista diretamente no player integrado.

## ✨ Funcionalidades

- **Swipe de Filmes** — Interface estilo Tinder para descobrir filmes
- **Sessões Compartilhadas** — Deslize com amigos e encontre matches
- **Detalhes com OMDb** — Sinopse, elenco, diretor, avaliações IMDb, gêneros, duração
- **Player Integrado** — Assista diretamente no app via embeds autorizados
- **Múltiplas Fontes** — Fallback automático entre fontes de reprodução
- **Scraper Modular** — Colete URLs de reprodução de fontes autorizadas
- **Favoritos e Likes** — Salve filmes e veja sua lista de curtidas
- **Filtros Avançados** — Gêneros, anos, ratings, duração, provedores
- **Modo Escuro** — Suporte automático ao tema do sistema
- **Responsivo** — Funciona em celular, tablet e desktop
- **PWA** — Instalável como app no celular

## 🚀 Início Rápido

### 1. Pré-requisitos
- Node.js 24+
- npm

### 2. Clone e configure
```bash
git clone https://github.com/IanDevel0per345/Janes-streaming-.git
cd Janes-streaming-
npm install
```

### 3. Configure as variáveis de ambiente
```bash
cp .env.example .env.local
```

Edite `.env.local` com suas configurações:

```bash
# Obrigatório: Chave da OMDb API (gratuita)
# Obtenha em: https://www.omdbapi.com/apikey.aspx
OMDB_API_KEY=sua_chave_aqui

# Provider de mídia: tmdb | jellyfin | plex | emby
PROVIDER=tmdb

# Se usar TMDB, configure o token de acesso:
# TMDB_ACCESS_TOKEN=seu_token_tmdb
```

### 4. Inicie o app
```bash
npm run dev
```

Acesse: http://localhost:4321

### 5. (Opcional) Use o script de setup
```bash
./scripts/start.sh
```

## 🔑 OMDb API

A [OMDb API](https://www.omdbapi.com/) fornece metadados de filmes:

| Dado | Descrição |
|------|-----------|
| Título | Nome do filme e título original |
| Pôster | URL da imagem do pôster |
| Sinopse | Resumo completo do filme |
| Ano | Ano de produção |
| Gênero | Gêneros do filme |
| Duração | Runtime em minutos |
| Diretor | Nome do diretor |
| Elenco | Principais atores |
| Classificação | MPAA rating (PG-13, R, etc.) |
| Avaliação IMDb | Nota IMDb (0-10) |
| Metascore | Nota Metacritic |
| País | País de origem |

**Obtenha sua chave gratuita:** https://www.omdbapi.com/apikey.aspx
- Plano gratuito: 1.000 requisições/dia
- Patreon: 100.000 requisições/dia

A chave é lida apenas no servidor via variável de ambiente. **Nunca** é exposta ao frontend.

## 🎥 Reprodução de Filmes

### Como funciona
1. Fontes de reprodução são armazenadas no banco de dados (tabela `MovieSource`)
2. Quando você abre os detalhes de um filme, as fontes ativas são carregadas
3. Clique em **Play** para assistir diretamente no player integrado (iframe)
4. Se houver múltiplas fontes, você pode alternar entre elas
5. Se uma fonte falhar, o player tenta automaticamente a próxima (fallback)

### Adicionar fontes manualmente

Via API:
```bash
curl -X POST http://localhost:4321/api/media/sources \
  -H "Content-Type: application/json" \
  -d '{
    "movieId": "tt1375666",
    "url": "https://fonte-autorizada.com/embed/123",
    "type": "embed",
    "quality": "1080p",
    "language": "pt-BR",
    "title": "Fonte A - Legendado",
    "provider": "manual"
  }'
```

### Gerenciar fontes

```bash
# Listar fontes de um filme
curl http://localhost:4321/api/media/sources?movieId=tt1375666

# Marcar fonte como quebrada
curl -X PATCH http://localhost:4321/api/media/sources \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "status": "broken"}'

# Remover fonte
curl -X DELETE http://localhost:4321/api/media/sources?id=1
```

## 🔍 Scraper

O scraper coleta URLs de reprodução de fontes públicas e autorizadas.

### Uso
```bash
# Buscar fontes para um filme
npx tsx src/scraper/run.ts --movie "Inception" --id tt1375666 --year 2010

# Usar provider específico
npx tsx src/scraper/run.ts --movie "The Matrix" --id tt0133092 --provider example

# Buscar sem salvar (dry-run)
npx tsx src/scraper/run.ts --movie "Inception" --id tt1375666 --dry-run

# Buscar para todos os filmes no banco
npx tsx src/scraper/run.ts --all
```

### Adicionar um novo provider de scraper

Veja instruções completas em `src/scraper/README.md`.

Em resumo:
1. Crie `src/scraper/providers/seu-provider.ts`
2. Estenda `BaseScraperProvider`
3. Registre em `src/scraper/registry.ts`

## 🔧 Variáveis de Ambiente

Veja `.env.example` para a lista completa. As principais:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `OMDB_API_KEY` | Sim | Chave da OMDb API |
| `PROVIDER` | Sim | Provider de mídia (tmdb, jellyfin, plex, emby) |
| `TMDB_ACCESS_TOKEN` | Se tmdb | Token de acesso TMDB |
| `JELLYFIN_URL` | Se jellyfin | URL do servidor Jellyfin |
| `DATABASE_URL` | Não | Caminho do banco SQLite |
| `AUTH_SECRET` | Não | Segredo de sessão (auto-gerado) |

## 🏗️ Arquitetura

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API Routes
│   │   ├── media/sources/  # ← NOVO: CRUD de fontes de reprodução
│   │   ├── omdb/movie/     # ← NOVO: Lookup OMDb por ID/título
│   │   ├── omdb/search/    # ← NOVO: Busca OMDb
│   │   └── ...
│   └── ...
├── lib/
│   ├── omdb/               # ← NOVO: Cliente OMDb + enriquecimento
│   ├── services/
│   │   └── movie-source-service.ts  # ← NOVO: Gerenciamento de sources
│   └── ...
├── scraper/                # ← NOVO: Scraper modular
│   ├── providers/          # Providers de scraper
│   ├── registry.ts         # Registro de providers
│   ├── run.ts              # CLI runner
│   └── types.ts            # Interfaces
├── db/
│   └── schema.ts           # Schema com MovieSource table (← NOVO)
└── components/
    └── movie/
        └── MovieDetailView.tsx  # Player integrado (← ATUALIZADO)
```

## 🐳 Docker

```bash
# Build
docker build -t janes-streaming .

# Run
docker run -p 4321:4321 \
  -e OMDB_API_KEY=sua_chave \
  -e PROVIDER=tmdb \
  -v ./janes-streaming-data:/app/data \
  janes-streaming
```

## 📝 Notas

- A interface visual do fork original foi **preservada integralmente**
- OMDb enriquece dados faltantes — nunca sobrescreve dados existentes dos providers
- Fontes de reprodução devem ser de fontes **autorizadas** — o scraper não contorna DRM ou paywalls
- O salt criptográfico `swiparr-guest-lending-v2` foi preservado para compatibilidade com tokens existentes

---

Feito com ❤️ para o Dia dos Pais
