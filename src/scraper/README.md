# Janes Streaming Scraper

## Visão Geral

O scraper é um sistema modular para coletar URLs de reprodução/embed de fontes públicas e autorizadas. Cada provedor de scraper implementa a interface `ScraperProvider` e pode ser ativado/desativado individualmente.

## ⚠️ AVISO IMPORTANTE

O scraper deve ser usado **APENAS** com fontes públicas e autorizadas onde você tem permissão para acessar o conteúdo. **NÃO** deve:

- Contornar DRM, autenticação ou paywalls
- Acessar links privados ou protegidos
- Burlar sistemas anti-bot ou bloqueios
- Violar termos de serviço de qualquer plataforma

## Estrutura

```
src/scraper/
├── index.ts          # Barrel export
├── types.ts          # Interfaces e BaseScraperProvider
├── registry.ts       # Registro de providers e funções de orquestração
├── run.ts            # CLI e batch runner
└── providers/
    └── example.ts    # Template de provider (desativado por padrão)
```

## Como Adicionar um Novo Provider

1. Crie um arquivo em `src/scraper/providers/`, ex: `meu-provider.ts`
2. Estenda `BaseScraperProvider`:

```typescript
import { BaseScraperProvider, ScraperSource } from "../types";

export class MeuProvider extends BaseScraperProvider {
  readonly name = "meu-provider";
  readonly description = "Descrição do meu provider";
  readonly enabled = true; // Ative quando configurado

  async scrape(movieId: string, movieTitle: string, year?: number): Promise<ScraperSource[]> {
    // 1. Busque o filme na fonte autorizada
    // 2. Encontre URLs de embed/reprodução
    // 3. Valide e normalize as URLs
    // 4. Retorne como ScraperSource[]
    return [];
  }
}
```

3. Registre em `src/scraper/registry.ts`:

```typescript
import { MeuProvider } from "./providers/meu-provider";

const PROVIDERS: ScraperProvider[] = [
  new ExampleScraperProvider(),
  new MeuProvider(),  // <-- Adicione aqui
];
```

## Uso via CLI

```bash
# Buscar fontes para um filme específico
npx tsx src/scraper/run.ts --movie "Inception" --id tt1375666 --year 2010

# Usar um provider específico
npx tsx src/scraper/run.ts --movie "The Matrix" --id tt0133092 --provider meu-provider

# Buscar para todos os filmes no banco
npx tsx src/scraper/run.ts --all

# Apenas buscar sem salvar no banco (dry-run)
npx tsx src/scraper/run.ts --movie "Inception" --id tt1375666 --dry-run
```

## Uso via API

### Adicionar fonte manualmente
```bash
POST /api/media/sources
{
  "movieId": "tt1375666",
  "url": "https://fonte-autorizada.example.com/embed/123",
  "type": "embed",
  "quality": "1080p",
  "language": "pt-BR",
  "title": "Fonte A - 1080p",
  "provider": "manual"
}
```

### Listar fontes de um filme
```bash
GET /api/media/sources?movieId=tt1375666
```

### Atualizar status de uma fonte
```bash
PATCH /api/media/sources
{ "id": 1, "status": "inactive" }
# status: "active" | "inactive" | "broken"
```

### Remover uma fonte
```bash
DELETE /api/media/sources?id=1
```

## Tipos de Source

| Tipo | Descrição |
|------|-----------|
| `embed` | URL de iframe (mais comum) |
| `direct` | URL direta de vídeo (mp4, etc.) |
| `hls` | Stream HLS (.m3u8) |
| `dash` | Stream DASH (.mpd) |

## Status de Source

| Status | Descrição |
|--------|-----------|
| `active` | Fonte funcional e disponível |
| `inactive` | Fonte temporariamente indisponível |
| `broken` | Fonte permanentemente quebrada |

## Validação de URLs

O `BaseScraperProvider` já inclui:
- `normalizeUrl()`: Normaliza URLs (trim, protocolo, barra final)
- `validateUrl()`: Verifica se URL está acessível via HEAD request
- Timeout de 10 segundos para validação

## Cache

O scraper não implementa cache interno — as fontes encontradas são salvas no banco (`MovieSource` table) e consultadas via API. Use o status `active`/`inactive`/`broken` para gerenciar a disponibilidade.
