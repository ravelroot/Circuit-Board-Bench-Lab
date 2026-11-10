import type { Footprint, Pad, ProjetoPcb } from '../../pcb/modelo';

export const COR_COBRE = '#c7843f';
export const COR_FR4 = '#b8a76c';
const ENIG = '#d8b55c';
const HASL = '#c9ccd1';
const FURO = '#0d0d0e';

const hex = (c: string): [number, number, number] => {
  const v = c.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};

export const misturar = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const m = (x: number, y: number): string => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
};

export const luminancia = (c: string): number => {
  const [r, g, b] = hex(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

export interface OpcoesTextura {
  readonly mascara: boolean;
  readonly serigrafia: boolean;
  readonly pxmm: number;
}

export const corAcabamento = (p: ProjetoPcb): string => (p.acabamento === 'enig' ? ENIG : HASL);

export const caminhoPad = (g: CanvasRenderingContext2D, pad: Pad, crescer = 0): void => {
  const l = pad.l + crescer * 2;
  const a = pad.a + crescer * 2;
  const x = pad.x - l / 2;
  const y = pad.y - a / 2;
  g.beginPath();
  if (pad.forma === 'redondo') {
    g.ellipse(pad.x, pad.y, l / 2, a / 2, 0, 0, Math.PI * 2);
  } else if (pad.forma === 'oval') {
    g.roundRect(x, y, l, a, Math.min(l, a) / 2);
  } else if (pad.forma === 'arredondado') {
    g.roundRect(x, y, l, a, Math.min(l, a) * 0.25);
  } else {
    g.rect(x, y, l, a);
  }
};

const tracarPolilinha = (g: CanvasRenderingContext2D, pontos: readonly (readonly [number, number])[]): void => {
  g.beginPath();
  pontos.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
};

const desenharCobre = (g: CanvasRenderingContext2D, p: ProjetoPcb, corBase: string, corCobre: string, corTrilha: string, verso: boolean): void => {
  const folga = 0.3 * p.escala;
  const camada = verso ? 'B.Cu' : 'F.Cu';
  g.fillStyle = corBase;
  g.fillRect(0, 0, p.largura, p.altura);
  g.fillStyle = corCobre;
  g.beginPath();
  g.roundRect(0.5, 0.5, p.largura - 1, p.altura - 1, Math.max(0, p.raio - 0.5));
  g.fill();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = corBase;
  for (const t of p.trilhas) {
    if (t.camada !== camada) continue;
    g.lineWidth = t.largura + folga * 2;
    tracarPolilinha(g, t.pontos);
  }
  g.fillStyle = corBase;
  for (const f of p.footprints) {
    for (const pad of f.pads) {
      if (verso && pad.furo === 0) continue;
      caminhoPad(g, pad, folga);
      g.fill();
    }
    for (const m of f.matrizes) {
      if (verso) continue;
      g.fillRect(m.x - folga, m.y - folga, m.l + folga * 2, m.a + folga * 2);
    }
  }
  for (const v of p.vias) {
    g.beginPath();
    g.arc(v.x, v.y, v.d / 2 + folga, 0, Math.PI * 2);
    g.fill();
  }
  for (const h of p.furos) {
    g.beginPath();
    g.arc(h.x, h.y, h.anel / 2 + folga * 2, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = corTrilha;
  for (const t of p.trilhas) {
    if (t.camada !== camada) continue;
    g.lineWidth = t.largura;
    tracarPolilinha(g, t.pontos);
  }
  if (!verso) {
    for (const a of p.antenas) {
      if (a.elevada) continue;
      g.lineWidth = a.largura;
      tracarPolilinha(g, a.pontos);
    }
  }
  g.fillStyle = corTrilha;
  for (const v of p.vias) {
    g.beginPath();
    g.arc(v.x, v.y, v.d / 2, 0, Math.PI * 2);
    g.fill();
  }
};

const desenharSerigrafia = (g: CanvasRenderingContext2D, p: ProjetoPcb, fps: readonly Footprint[]): void => {
  const largura = Math.min(0.3, 0.15 * Math.max(1, p.escala * 0.8));
  g.strokeStyle = p.corSerigrafia;
  g.fillStyle = p.corSerigrafia;
  g.lineWidth = largura;
  g.lineCap = 'round';
  for (const f of fps) {
    g.beginPath();
    for (const sgm of f.silk) {
      g.moveTo(sgm.x1, sgm.y1);
      g.lineTo(sgm.x2, sgm.y2);
    }
    g.stroke();
    for (const c of f.silkCirculos) {
      g.beginPath();
      if (c.r < 0.5) {
        g.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        g.fill();
      } else {
        g.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }
  const tamanho = Math.min(3, Math.max(0.9, Math.max(p.largura, p.altura) / 80));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `500 ${tamanho}px "IBM Plex Mono", monospace`;
  for (const f of fps) {
    if (f.modelo === 'antena' || f.modelo === 'pads' || f.modelo === 'cabo') continue;
    g.fillText(f.ref, f.refPos.x, f.refPos.y);
  }
  for (const t of p.textos) {
    g.font = `700 ${t.tamanho}px "Bricolage Grotesque Variable", "Instrument Sans Variable", sans-serif`;
    g.fillText(t.texto, t.x, t.y);
  }
};

const desenharPads = (g: CanvasRenderingContext2D, p: ProjetoPcb, verso: boolean): void => {
  const metal = corAcabamento(p);
  for (const f of p.footprints) {
    for (const pad of f.pads) {
      if (verso && pad.furo === 0) continue;
      g.fillStyle = metal;
      caminhoPad(g, pad);
      g.fill();
      if (pad.furo > 0) {
        g.fillStyle = FURO;
        g.beginPath();
        g.arc(pad.x, pad.y, pad.furo / 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (verso) continue;
    for (const m of f.matrizes) {
      g.fillStyle = misturar(metal, '#000000', 0.15);
      g.fillRect(m.x, m.y, m.l, m.a);
      g.fillStyle = metal;
      const r = m.passo * 0.28;
      for (let yy = m.y + m.passo / 2; yy < m.y + m.a; yy += m.passo) {
        for (let xx = m.x + m.passo / 2; xx < m.x + m.l; xx += m.passo) {
          g.beginPath();
          g.arc(xx, yy, r, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }
  for (const h of p.furos) {
    g.fillStyle = metal;
    g.beginPath();
    g.arc(h.x, h.y, h.anel / 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = FURO;
    g.beginPath();
    g.arc(h.x, h.y, h.d / 2, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = FURO;
  for (const v of p.vias) {
    g.beginPath();
    g.arc(v.x, v.y, v.furo / 2, 0, Math.PI * 2);
    g.fill();
  }
};

export const desenharFace = (p: ProjetoPcb, o: OpcoesTextura, verso = false): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(64, Math.round(p.largura * o.pxmm));
  canvas.height = Math.max(64, Math.round(p.altura * o.pxmm));
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.save();
  if (verso) {
    g.translate(canvas.width, 0);
    g.scale(-1, 1);
  }
  g.scale(canvas.width / p.largura, canvas.height / p.altura);
  if (o.mascara) {
    const escura = luminancia(p.corMascara) < 0.12;
    const base = misturar(p.corMascara, '#000000', escura ? 0.35 : 0.28);
    const cobre = escura ? misturar(p.corMascara, '#5a5f66', 0.12) : misturar(p.corMascara, COR_COBRE, 0.16);
    const trilha = escura ? misturar(p.corMascara, '#6a7078', 0.28) : misturar(p.corMascara, COR_COBRE, 0.3);
    desenharCobre(g, p, base, cobre, trilha, verso);
  } else {
    desenharCobre(g, p, COR_FR4, misturar(COR_COBRE, '#000000', 0.08), misturar(COR_COBRE, '#ffffff', 0.08), verso);
  }
  if (o.serigrafia && !verso) desenharSerigrafia(g, p, p.footprints);
  desenharPads(g, p, verso);
  g.restore();
  return canvas;
};

export const rotuloCanvas = (texto: string, cor: string, largura: number, altura: number, fundo: string | null = null): HTMLCanvasElement => {
  const escala = 24;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(32, Math.min(1024, Math.round(largura * escala)));
  canvas.height = Math.max(32, Math.min(1024, Math.round(altura * escala)));
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  if (fundo) {
    g.fillStyle = fundo;
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  g.fillStyle = cor;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let tamanho = canvas.height * 0.32;
  g.font = `500 ${tamanho}px "IBM Plex Mono", monospace`;
  while (g.measureText(texto).width > canvas.width * 0.86 && tamanho > 6) {
    tamanho *= 0.9;
    g.font = `500 ${tamanho}px "IBM Plex Mono", monospace`;
  }
  g.fillText(texto, canvas.width / 2, canvas.height / 2);
  return canvas;
};

export const listrasCanvas = (fundo: string, faixas: readonly (readonly [number, number, string])[], horizontal = true): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = horizontal ? 256 : 16;
  canvas.height = horizontal ? 16 : 256;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.fillStyle = fundo;
  g.fillRect(0, 0, canvas.width, canvas.height);
  for (const [inicio, fim, cor] of faixas) {
    g.fillStyle = cor;
    if (horizontal) g.fillRect(inicio * 256, 0, (fim - inicio) * 256, 16);
    else g.fillRect(0, inicio * 256, 16, (fim - inicio) * 256);
  }
  return canvas;
};

export const gradeFurosCanvas = (cols: number, linhas: number): HTMLCanvasElement => {
  const px = 24;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, cols) * px;
  canvas.height = Math.max(1, linhas) * px;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.fillStyle = '#18181a';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#030303';
  for (let j = 0; j < linhas; j++) for (let i = 0; i < cols; i++) g.fillRect(i * px + px * 0.32, j * px + px * 0.32, px * 0.36, px * 0.36);
  return canvas;
};

export const tampaCapacitorCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const grad = g.createRadialGradient(54, 50, 6, 64, 64, 64);
  grad.addColorStop(0, '#f1f2f4');
  grad.addColorStop(1, '#9ea3a9');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(64, 18);
  g.lineTo(64, 110);
  g.moveTo(64, 64);
  g.lineTo(26, 92);
  g.moveTo(64, 64);
  g.lineTo(102, 92);
  g.stroke();
  return canvas;
};

export const malhaCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.fillStyle = '#b9bdc2';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#2a2c30';
  for (let y = 4; y < 128; y += 7) for (let x = 4 + ((y / 7) % 2) * 3; x < 128; x += 7) g.fillRect(x, y, 3, 3);
  return canvas;
};

export const submoduloCanvas = (cor: string, metal: string, l: number, a: number): HTMLCanvasElement => {
  const pxmm = 20;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(l * pxmm);
  canvas.height = Math.round(a * pxmm);
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.scale(pxmm, pxmm);
  g.fillStyle = cor;
  g.fillRect(0, 0, l, a);
  g.fillStyle = metal;
  const passo = Math.max(l, a) > 40 ? 2.54 : 1.27;
  for (let x = 1; x < l - 0.5; x += passo) {
    g.beginPath();
    g.arc(x, 0, passo * 0.28, 0, Math.PI);
    g.fill();
    g.beginPath();
    g.arc(x, a, passo * 0.28, Math.PI, Math.PI * 2);
    g.fill();
  }
  return canvas;
};

export const desenharPbr = (p: ProjetoPcb, pxmm: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(64, Math.round(p.largura * pxmm));
  canvas.height = Math.max(64, Math.round(p.altura * pxmm));
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.scale(canvas.width / p.largura, canvas.height / p.altura);
  g.fillStyle = 'rgb(0, 110, 0)';
  g.fillRect(0, 0, p.largura, p.altura);
  g.fillStyle = p.acabamento === 'enig' ? 'rgb(0, 70, 255)' : 'rgb(0, 95, 255)';
  for (const f of p.footprints) {
    for (const pad of f.pads) {
      caminhoPad(g, pad);
      g.fill();
    }
    for (const m of f.matrizes) g.fillRect(m.x, m.y, m.l, m.a);
  }
  for (const h of p.furos) {
    g.beginPath();
    g.arc(h.x, h.y, h.anel / 2, 0, Math.PI * 2);
    g.fill();
  }
  return canvas;
};
