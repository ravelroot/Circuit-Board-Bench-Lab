import type { IconeLab } from '../dados/tipos';
import { MARCA } from '../marca';
import { s } from './dom';

const CAMINHOS = {
  busca: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-4-4'],
  teclado: ['M3 6h18v12H3z', 'M7 10h.01', 'M11 10h.01', 'M15 10h.01', 'M7 14h10'],
  github: [
    'M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  ],
  globo: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'],
  lua: ['M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z'],
  sol: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 2v2', 'M12 20v2', 'm4.9 4.9 1.4 1.4', 'm17.7 17.7 1.4 1.4', 'M2 12h2', 'M20 12h2', 'm4.9 19.1 1.4-1.4', 'm17.7 6.3 1.4-1.4'],
  direita: ['m9 6 6 6-6 6'],
  esquerda: ['m15 6-6 6 6 6'],
  cima: ['m6 15 6-6 6 6'],
  fechar: ['M6 6l12 12', 'M18 6 6 18'],
  check: ['m5 12 4.5 4.5L19 7'],
  copiar: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  girar: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
  explodir: ['M12 3v5', 'm9 5 3 3 3-3', 'M12 21v-5', 'm9 19 3-3 3 3', 'M4 12h16'],
  centralizar: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5', 'M12 12h.01'],
  mais: ['M12 5v14', 'M5 12h14'],
  menos: ['M5 12h14'],
  grade: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  terminal: ['M4 5h16v14H4z', 'm7 10 3 2-3 2', 'M12 15h5'],
  led: ['M8 13V9a4 4 0 1 1 8 0v4', 'M6 13h12', 'M9 13v7', 'M15 13v5', 'M12 2v1', 'm18 4-1 1', 'm6 4 1 1'],
  botao: ['M5 9h14v10H5z', 'M9 9V6h6v3', 'M9 14h6'],
  tela: ['M3 5h18v12H3z', 'M8 21h8', 'M12 17v4', 'M7 9h6', 'M7 12h9'],
  wifi: ['M2 9a15 15 0 0 1 20 0', 'M5 12.5a10 10 0 0 1 14 0', 'M8.5 16a5 5 0 0 1 7 0', 'M12 19.5h.01'],
  cartao: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4'],
  microfone: ['M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  bluetooth: ['m7 7 10 10-5 4V3l5 4L7 17'],
  som: ['M4 9v6h4l5 4V5L8 9H4Z', 'M16 9a4 4 0 0 1 0 6', 'M19 6a8 8 0 0 1 0 12'],
  motor: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z', 'M12 12h.01', 'M2 12h5', 'M17 12h5'],
  regua: ['M3 16 16 3l5 5L8 21Z', 'm7 12 2 2', 'm10 9 2 2', 'm13 6 2 2'],
  termometro: ['M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0Z', 'M12 9v8'],
  servo: ['M4 8h12v10H4z', 'M16 13h4', 'M8 8V5h4', 'm12 5 6-2'],
  chip: ['M7 7h10v10H7z', 'M10 3v4', 'M14 3v4', 'M10 17v4', 'M14 17v4', 'M3 10h4', 'M3 14h4', 'M17 10h4', 'M17 14h4'],
  disco: ['M3 8h18v8H3z', 'M6 12h.01', 'M10 12h7'],
  memoria: ['M3 7h18v9H3z', 'M7 16v3', 'M11 16v3', 'M15 16v3', 'M7 10v3', 'M11 10v3', 'M15 10v3'],
  raio: ['M13 2 4 14h7l-1 8 9-12h-7Z'],
  onda: ['M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0'],
  pino: ['M8 3h8v6H8z', 'M12 9v12', 'M10 6h4'],
  chave: ['M4 16h4l8-6', 'M16 16h4', 'M4 16a1 1 0 1 0 0 .01'],
} as const;

export type NomeIcone = keyof typeof CAMINHOS | 'tocar' | 'pausar';

export const icone = (nome: NomeIcone | IconeLab, classe = 'icone'): SVGSVGElement => {
  const svg = s('svg', { class: classe, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
  if (nome === 'tocar') {
    svg.append(s('path', { d: 'M7 4.5v15l12-7.5-12-7.5Z', fill: 'currentColor', stroke: 'none' }));
    return svg;
  }
  if (nome === 'pausar') {
    svg.append(s('rect', { x: 6, y: 5, width: 4, height: 14, fill: 'currentColor', stroke: 'none' }));
    svg.append(s('rect', { x: 14, y: 5, width: 4, height: 14, fill: 'currentColor', stroke: 'none' }));
    return svg;
  }
  for (const d of CAMINHOS[nome]) {
    svg.append(s('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }
  return svg;
};

const caminhoGrade = (grade: readonly string[]): string => {
  const partes: string[] = [];
  grade.forEach((linha, y) => {
    let x = 0;
    while (x < linha.length) {
      if (linha[x] === '#') {
        const inicio = x;
        while (x < linha.length && linha[x] === '#') x++;
        partes.push(`M${inicio} ${y}h${x - inicio}v1h-${x - inicio}z`);
      } else {
        x++;
      }
    }
  });
  return partes.join('');
};

export const logotipo = (classe = 'logotipo'): SVGSVGElement => {
  const svg = s('svg', { class: classe, viewBox: '0 0 12 12', 'shape-rendering': 'crispEdges', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(s('path', { d: caminhoGrade(MARCA.grade), fill: 'currentColor' }));
  return svg;
};

const LETRAS: Record<string, readonly string[]> = {
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
};

export const letreiro = (texto: string, classe = 'letreiro'): SVGSVGElement => {
  const letras = [...texto.toUpperCase()].map((ch) => LETRAS[ch] ?? LETRAS.O ?? []);
  const largura = letras.length * 5 + (letras.length - 1) * 2;
  const svg = s('svg', { class: classe, viewBox: `0 0 ${largura} 7`, 'shape-rendering': 'crispEdges', role: 'img', 'aria-label': texto });
  const partes: string[] = [];
  letras.forEach((letra, i) => {
    letra.forEach((linha, y) => {
      [...linha].forEach((ch, x) => {
        if (ch === '#') partes.push(`M${i * 7 + x} ${y}h1v1h-1z`);
      });
    });
  });
  svg.append(s('path', { d: partes.join(''), fill: 'currentColor' }));
  return svg;
};
