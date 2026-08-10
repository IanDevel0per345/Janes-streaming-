/**
 * Live TV & Sports Channels — Jane's Streaming
 * 
 * Predefined channels for live TV and sports streaming.
 * channelId maps to the provider's internal path.
 */

export type LiveCategory = "abertos" | "esportes" | "noticias" | "filmes" | "infantil" | "musicas" | "documentarios";

export interface LiveChannel {
  id: string;
  name: string;
  logo: string;
  category: LiveCategory;
  /** If true, uses iframe embed. If false, uses m3u8/HLS direct */
  isEmbed: boolean;
  /** For direct streams, the HLS/m3u8 URL */
  streamUrl?: string;
  /** Keywords for search */
  tags: string[];
  description?: string;
}

export const LIVE_CATEGORIES: { id: LiveCategory; label: string; icon: string }[] = [
  { id: "abertos", label: "TV Aberta", icon: "📺" },
  { id: "esportes", label: "Esportes", icon: "⚽" },
  { id: "noticias", label: "Notícias", icon: "📰" },
  { id: "filmes", label: "Canais de Filmes", icon: "🎬" },
  { id: "infantil", label: "Infantil", icon: "🧸" },
  { id: "musicas", label: "Música", icon: "🎵" },
  { id: "documentarios", label: "Documentários", icon: "🔬" },
];

/**
 * All live channels.
 * Stream URLs point to free publicly available IPTV streams.
 */
export const LIVE_CHANNELS: LiveChannel[] = [
  // ─── TV ABERTA (BRASIL) ──────────────────────────────────────
  {
    id: "tv-globo",
    name: "TV Globo",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Logotipo_TV_Globo_2021.svg/200px-Logotipo_TV_Globo_2021.svg.png",
    category: "abertos",
    isEmbed: true,
    tags: ["globo", "novela", "jornal", "brasil", "ao vivo"],
    description: "TV Globo ao vivo — novelas, jornalismo e entretenimento",
  },
  {
    id: "sbt",
    name: "SBT",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/SBT_logo_2021.svg/200px-SBT_logo_2021.svg.png",
    category: "abertos",
    isEmbed: true,
    tags: ["sbt", "record", "aberto", "brasil"],
    description: "SBT ao vivo — programação variada",
  },
  {
    id: "record-tv",
    name: "Record TV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Record_TV_logo_2022.svg/200px-Record_TV_logo_2022.svg.png",
    category: "abertos",
    isEmbed: true,
    tags: ["record", "brasil", "ao vivo"],
    description: "Record TV ao vivo",
  },
  {
    id: "band",
    name: "TV Bandeirantes",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Logotipo_TV_Bandeirantes_2023.svg/200px-Logotipo_TV_Bandeirantes_2023.svg.png",
    category: "abertos",
    isEmbed: true,
    tags: ["band", "bandeirantes", "brasil"],
    description: "TV Bandeirantes ao vivo — esportes e jornalismo",
  },
  {
    id: "redetv",
    name: "RedeTV!",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/RedeTV%21_logo_2019.svg/200px-RedeTV%21_logo_2019.svg.png",
    category: "abertos",
    isEmbed: true,
    tags: ["redetv", "brasil", "tv aberta"],
    description: "RedeTV! ao vivo",
  },
  {
    id: "cultura",
    name: "TV Cultura",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/TV_Cultura_logo_2015.svg/200px-TV_Cultura_logo_2015.svg.png",
    category: "abertos",
    isEmbed: true,
    tags: ["cultura", "educativo", "brasil"],
    description: "TV Cultura — programação cultural e educativa",
  },

  // ─── ESPORTES ────────────────────────────────────────────────
  {
    id: "espn-brasil",
    name: "ESPN Brasil",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/ESPN_logo_2022.svg/200px-ESPN_logo_2022.svg.png",
    category: "esportes",
    isEmbed: true,
    tags: ["espn", "futebol", "esportes", "nba", "nfl"],
    description: "ESPN Brasil — futebol, NBA, NFL e mais",
  },
  {
    id: "sportv",
    name: "SporTV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/SporTV_logo_2021.svg/200px-SporTV_logo_2021.svg.png",
    category: "esportes",
    isEmbed: true,
    tags: ["sportv", "futebol", "campeonato brasileiro", "libertadores"],
    description: "SporTV — Campeonato Brasileiro, Libertadores e mais",
  },
  {
    id: "premiere",
    name: "Premiere",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Premiere_logo_2021.svg/200px-Premiere_logo_2021.svg.png",
    category: "esportes",
    isEmbed: true,
    tags: ["premiere", "futebol", "brasil", "campeonato"],
    description: "Premiere — Futebol Brasileiro ao vivo",
  },
  {
    id: "fox-sports",
    name: "Fox Sports",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Fox_Sports_logo_2019.svg/200px-Fox_Sports_logo_2019.svg.png",
    category: "esportes",
    isEmbed: true,
    tags: ["fox", "sports", "futebol", "f1", "motorsport"],
    description: "Fox Sports — F1, MotoGP e esportes globais",
  },
  {
    id: "tnt-sports",
    name: "TNT Sports",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/TNT_Sports_logo_2023.svg/200px-TNT_Sports_logo_2023.svg.png",
    category: "esportes",
    isEmbed: true,
    tags: ["tnt", "champions", "europa", "futebol europeu"],
    description: "TNT Sports — Champions League e futebol europeu",
  },
  {
    id: "nba-tv",
    name: "NBA TV",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/4/48/NBA_TV_logo.svg/200px-NBA_TV_logo.svg.png",
    category: "esportes",
    isEmbed: true,
    tags: ["nba", "basquete", "basketball"],
    description: "NBA TV — Basquete ao vivo",
  },
  {
    id: "f1-tv",
    name: "F1 TV",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/5/51/F1_TV_logo.svg/200px-F1_TV_logo.svg.png",
    category: "esportes",
    isEmbed: true,
    tags: ["f1", "formula 1", "corrida", "race"],
    description: "Fórmula 1 ao vivo — todas as corridas",
  },
  {
    id: "ufc-live",
    name: "UFC Live",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/UFC_Logo.svg/200px-UFC_Logo.svg.png",
    category: "esportes",
    isEmbed: true,
    tags: ["ufc", "mma", "luta", "fight"],
    description: "UFC ao vivo — lutas e eventos",
  },

  // ─── NOTÍCIAS ────────────────────────────────────────────────
  {
    id: "globo-news",
    name: "GloboNews",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/GloboNews_logo_2021.svg/200px-GloboNews_logo_2021.svg.png",
    category: "noticias",
    isEmbed: true,
    tags: ["globo news", "noticias", "jornalismo"],
    description: "GloboNews — notícias 24 horas",
  },
  {
    id: "cnn-brasil",
    name: "CNN Brasil",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/CNN_Brasil_logo_2020.svg/200px-CNN_Brasil_logo_2020.svg.png",
    category: "noticias",
    isEmbed: true,
    tags: ["cnn", "brasil", "noticias", "jornalismo"],
    description: "CNN Brasil — jornalismo ao vivo",
  },
  {
    id: "band-news",
    name: "Band News",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Band_News_logo_2021.svg/200px-Band_News_logo_2021.svg.png",
    category: "noticias",
    isEmbed: true,
    tags: ["band news", "noticias", "24h"],
    description: "Band News — notícias 24h",
  },
  {
    id: "record-news",
    name: "Record News",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Record_News_logo_2021.svg/200px-Record_News_logo_2021.svg.png",
    category: "noticias",
    isEmbed: true,
    tags: ["record news", "noticias"],
    description: "Record News ao vivo",
  },

  // ─── CANAIS DE FILMES ────────────────────────────────────────
  {
    id: "telecine-premium",
    name: "Telecine Premium",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Telecine_logo_2021.svg/200px-Telecine_logo_2021.svg.png",
    category: "filmes",
    isEmbed: true,
    tags: ["telecine", "premium", "filme", "cinema"],
    description: "Telecine Premium — filmes 24h",
  },
  {
    id: "telecine-action",
    name: "Telecine Action",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Telecine_logo_2021.svg/200px-Telecine_logo_2021.svg.png",
    category: "filmes",
    isEmbed: true,
    tags: ["telecine", "action", "ação", "filme"],
    description: "Telecine Action — filmes de ação 24h",
  },
  {
    id: "hbo",
    name: "HBO",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/HBO_logo_2021.svg/200px-HBO_logo_2021.svg.png",
    category: "filmes",
    isEmbed: true,
    tags: ["hbo", "filme", "serie", "max"],
    description: "HBO — filmes, séries e documentários",
  },
  {
    id: "megapix",
    name: "MegaPix",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Megapix_logo_2021.svg/200px-Megapix_logo_2021.svg.png",
    category: "filmes",
    isEmbed: true,
    tags: ["megapix", "filme", "cinema"],
    description: "MegaPix — filmes 24h",
  },
  {
    id: "paramount",
    name: "Paramount Channel",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Paramount_Network_logo_2021.svg/200px-Paramount_Network_logo_2021.svg.png",
    category: "filmes",
    isEmbed: true,
    tags: ["paramount", "filme", "canal"],
    description: "Paramount Channel — filmes e séries",
  },
  {
    id: "star-channel",
    name: "Star Channel",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Star_Channel_logo_2021.svg/200px-Star_Channel_logo_2021.svg.png",
    category: "filmes",
    isEmbed: true,
    tags: ["star", "channel", "filme"],
    description: "Star Channel — filmes e séries",
  },

  // ─── INFANTIL ────────────────────────────────────────────────
  {
    id: "cartoon-network",
    name: "Cartoon Network",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cartoon_Network_2010_logo.svg/200px-Cartoon_Network_2010_logo.svg.png",
    category: "infantil",
    isEmbed: true,
    tags: ["cartoon", "desenho", "criança", "infantil"],
    description: "Cartoon Network — desenhos animados ao vivo",
  },
  {
    id: "disney-channel",
    name: "Disney Channel",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Disney_Channel_logo_2014.svg/200px-Disney_Channel_logo_2014.svg.png",
    category: "infantil",
    isEmbed: true,
    tags: ["disney", "criança", "infantil", "desenho"],
    description: "Disney Channel — programação infantil ao vivo",
  },
  {
    id: "nickelodeon",
    name: "Nickelodeon",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Nickelodeon_logo_2023.svg/200px-Nickelodeon_logo_2023.svg.png",
    category: "infantil",
    isEmbed: true,
    tags: ["nickelodeon", "nick", "infantil", "desenho"],
    description: "Nickelodeon — desenhos e séries infantis",
  },
  {
    id: "discovery-kids",
    name: "Discovery Kids",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Discovery_Kids_logo_2016.svg/200px-Discovery_Kids_logo_2016.svg.png",
    category: "infantil",
    isEmbed: true,
    tags: ["discovery", "kids", "infantil", "educativo"],
    description: "Discovery Kids — conteúdo educativo infantil",
  },

  // ─── MÚSICA ──────────────────────────────────────────────────
  {
    id: "mtv-brasil",
    name: "MTV Brasil",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/MTV_logo_2021.svg/200px-MTV_logo_2021.svg.png",
    category: "musicas",
    isEmbed: true,
    tags: ["mtv", "musica", "clipe", "video"],
    description: "MTV Brasil — clipes e programas musicais",
  },
  {
    id: "vh1",
    name: "VH1",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/VH1_logo_2020.svg/200px-VH1_logo_2020.svg.png",
    category: "musicas",
    isEmbed: true,
    tags: ["vh1", "musica", "classicos", "hits"],
    description: "VH1 — clássicos e hits musicais",
  },
  {
    id: "bis",
    name: "BIS",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/BIS_logo_2021.svg/200px-BIS_logo_2021.svg.png",
    category: "musicas",
    isEmbed: true,
    tags: ["bis", "musica", "brasil"],
    description: "BIS — música brasileira 24h",
  },

  // ─── DOCUMENTÁRIOS ──────────────────────────────────────────
  {
    id: "discovery-channel",
    name: "Discovery Channel",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Discovery_Channel_logo_2019.svg/200px-Discovery_Channel_logo_2019.svg.png",
    category: "documentarios",
    isEmbed: true,
    tags: ["discovery", "documentario", "ciencia", "natureza"],
    description: "Discovery Channel — documentários e ciência",
  },
  {
    id: "nat-geo",
    name: "National Geographic",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Nat_Geo_logo_2016.svg/200px-Nat_Geo_logo_2016.svg.png",
    category: "documentarios",
    isEmbed: true,
    tags: ["nat geo", "national geographic", "documentario", "natureza"],
    description: "National Geographic — natureza, ciência e exploração",
  },
  {
    id: "history-channel",
    name: "History Channel",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/History_Channel_logo_2015.svg/200px-History_Channel_logo_2015.svg.png",
    category: "documentarios",
    isEmbed: true,
    tags: ["history", "historia", "documentario"],
    description: "History Channel — história e documentários",
  },
  {
    id: "animal-planet",
    name: "Animal Planet",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Animal_Planet_logo_2018.svg/200px-Animal_Planet_logo_2018.svg.png",
    category: "documentarios",
    isEmbed: true,
    tags: ["animal planet", "animais", "natureza"],
    description: "Animal Planet — vida selvagem e natureza",
  },
  {
    id: "food-network",
    name: "Food Network",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Food_Network_logo_2018.svg/200px-Food_Network_logo_2018.svg.png",
    category: "documentarios",
    isEmbed: true,
    tags: ["food", "network", "culinaria", "gastronomia"],
    description: "Food Network — programas de culinária",
  },
];

/** Get channels by category */
export function getChannelsByCategory(category: LiveCategory): LiveChannel[] {
  return LIVE_CHANNELS.filter((ch) => ch.category === category);
}

/** Search channels by name or tags */
export function searchChannels(query: string): LiveChannel[] {
  const q = query.toLowerCase().trim();
  if (!q) return LIVE_CHANNELS;
  return LIVE_CHANNELS.filter(
    (ch) =>
      ch.name.toLowerCase().includes(q) ||
      ch.tags.some((t) => t.includes(q)) ||
      ch.description?.toLowerCase().includes(q)
  );
}
