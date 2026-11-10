import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './css/estilo.css';
import type { Contexto, Pagina } from './app/contexto';
import { criarEstado, Loja, type Rota } from './app/estado';
import { caminho, lerRota, mesmaRota } from './app/rotas';
import { labPorId, labsDaPlaca } from './dados/laboratorios';
import { pecaPorId } from './dados/pecas';
import { placaPorId, PLACAS } from './dados/placas';
import { definirIdioma, ui } from './i18n/textos';
import { montarCabecalho } from './ui/cabecalho';
import { montarCatalogo } from './ui/catalogo';
import { montarAjuda, montarBusca } from './ui/dialogos';
import { h } from './ui/dom';
import { montarPaginaLab } from './ui/pagina-lab';
import { montarPaginaPlaca } from './ui/pagina-placa';

const catalogo = {
  placa: (id: string) => placaPorId(id) !== undefined,
  lab: (placa: string, lab: string) => labPorId(lab)?.placa === placa,
  inicial: PLACAS[0]?.id ?? 'esp32-s3',
};

const loja = new Loja(
  criarEstado(lerRota(location.hash, catalogo), {
    peca: (id) => pecaPorId(id) !== undefined,
    lab: (id) => labPorId(id) !== undefined,
    passos: (id) => labPorId(id)?.passos.length ?? 0,
  }),
);

const navegar = (rota: Rota): void => {
  const destino = caminho(rota);
  if (location.hash !== destino) history.pushState(null, '', destino);
  loja.alterar({ rota });
};

const ctx: Contexto = { loja, navegar };

definirIdioma(loja.atual.idioma);

const aplicarTema = (): void => {
  document.documentElement.dataset.tema = loja.atual.tema;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', loja.atual.tema === 'escuro' ? 'dark' : 'light');
};
aplicarTema();

const palco = h('main', { class: 'pagina', id: 'conteudo' });
const app = h('div', { class: 'app' }, montarCabecalho(ctx), palco, montarBusca(ctx), montarAjuda(ctx));
let atual: Pagina | null = null;

const titulo = (): string => {
  const { rota } = loja.atual;
  const placa = placaPorId(rota.placa);
  const lab = labPorId(rota.lab);
  if (lab && placa) return `${lab.titulo[loja.atual.idioma]} · ${placa.nome} · Rumo`;
  if (placa) return `${placa.nome} · Rumo`;
  return `${ui('catalogoTitulo', { n: PLACAS.length })} · Rumo`;
};

const desenhar = (rolar: boolean): void => {
  atual?.destruir();
  const { rota } = loja.atual;
  if (rota.pagina === 'lab' && rota.lab) atual = montarPaginaLab(ctx, rota.lab);
  else if (rota.pagina === 'placa' && rota.placa) atual = montarPaginaPlaca(ctx, rota.placa);
  else atual = montarCatalogo(ctx);
  palco.replaceChildren(atual.el);
  document.title = titulo();
  if (rolar) window.scrollTo({ top: 0 });
};

loja.assinar((e, a) => {
  if (e.idioma !== a.idioma) {
    definirIdioma(e.idioma);
    desenhar(false);
  } else if (!mesmaRota(e.rota, a.rota)) {
    desenhar(true);
  }
  if (e.tema !== a.tema) aplicarTema();
});

window.addEventListener('popstate', () => loja.alterar({ rota: lerRota(location.hash, catalogo) }));
window.addEventListener('hashchange', () => {
  const rota = lerRota(location.hash, catalogo);
  if (!mesmaRota(rota, loja.atual.rota)) loja.alterar({ rota });
});

const vizinhoPlaca = (direcao: 1 | -1): void => {
  const i = PLACAS.findIndex((p) => p.id === loja.atual.rota.placa);
  const alvo = PLACAS[(i + direcao + PLACAS.length) % PLACAS.length];
  if (alvo) navegar({ pagina: 'placa', placa: alvo.id, lab: null });
};

const vizinhoLab = (direcao: 1 | -1): void => {
  const { rota } = loja.atual;
  if (!rota.placa) return;
  const labs = labsDaPlaca(rota.placa);
  if (labs.length === 0) return;
  const i = labs.findIndex((l) => l.id === rota.lab);
  const alvo = i < 0 ? (direcao === 1 ? labs[0] : labs[labs.length - 1]) : labs[i + direcao];
  if (alvo) navegar({ pagina: 'lab', placa: rota.placa, lab: alvo.id });
};

document.addEventListener('keydown', (ev) => {
  const e = loja.atual;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
    ev.preventDefault();
    loja.alterar({ busca: !e.busca, ajuda: false });
    return;
  }
  if (e.busca || e.ajuda) return;
  const alvo = ev.target as HTMLElement | null;
  if (alvo && (alvo.closest('input, select, textarea, .visor, .editor, .simulador') || alvo.isContentEditable)) return;
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const acoes: Record<string, () => void> = {
    '/': () => loja.alterar({ busca: true }),
    t: () => loja.alterar({ tema: e.tema === 'escuro' ? 'claro' : 'escuro' }),
    l: () => loja.alterar({ idioma: e.idioma === 'pt' ? 'en' : 'pt' }),
    p: () => navegar({ pagina: 'catalogo', placa: null, lab: null }),
    ',': () => vizinhoPlaca(-1),
    '.': () => vizinhoPlaca(1),
    '[': () => vizinhoLab(-1),
    ']': () => vizinhoLab(1),
    e: () => document.querySelector<HTMLButtonElement>('.janela[data-aba="3d"] .botao-explodir')?.click(),
    '?': () => loja.alterar({ ajuda: true }),
  };
  const acao = acoes[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key] ?? acoes[ev.key];
  if (!acao) return;
  ev.preventDefault();
  acao();
});

if (!location.hash) history.replaceState(null, '', caminho(loja.atual.rota));
desenhar(false);
const raiz = document.getElementById('app');
if (raiz) raiz.replaceWith(app);
