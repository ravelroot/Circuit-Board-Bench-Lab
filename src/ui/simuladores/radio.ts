import { h, s, trocar } from '../dom';
import { abas, fmt, L, quadroSim, Relogio, type Simulador } from './base';

interface Rede {
  readonly ssid: string;
  readonly canal: number;
  readonly base: number;
  readonly seg: string;
  rssi: number;
}

const qualidade = (rssi: number): string => (rssi > -50 ? L('excelente', 'excellent') : rssi > -65 ? L('boa', 'good') : rssi > -75 ? L('usável', 'usable') : L('fraca', 'weak'));

const barras = (rssi: number): HTMLElement => {
  const nivel = rssi > -50 ? 4 : rssi > -65 ? 3 : rssi > -75 ? 2 : 1;
  return h('span', { class: 'barras', 'aria-hidden': 'true' }, ...[1, 2, 3, 4].map((n) => h('i', { class: n <= nivel ? 'on' : '' })));
};

export const simWifi = (): Simulador => {
  const relogio = new Relogio();
  const redes: Rede[] = [
    { ssid: 'casa-rumo', canal: 6, base: -42, seg: 'WPA2', rssi: -42 },
    { ssid: 'casa-rumo-visitas', canal: 6, base: -47, seg: 'WPA2', rssi: -47 },
    { ssid: 'vizinho-a', canal: 1, base: -63, seg: 'WPA2', rssi: -63 },
    { ssid: 'vizinho-b', canal: 11, base: -71, seg: 'WPA3', rssi: -71 },
    { ssid: 'impressora-direct', canal: 11, base: -76, seg: 'WPA2', rssi: -76 },
    { ssid: 'cafe-aberto', canal: 3, base: -82, seg: L('aberta', 'open'), rssi: -82 },
    { ssid: '(oculta)', canal: 9, base: -88, seg: 'WPA2', rssi: -88 },
  ];
  let vista: 'redes' | 'canais' | 'sinal' = 'redes';
  let escolhida = 0;
  let varreduras = 1;
  const corpo = h('div', { class: 'sim-corpo' });
  const rodape = h('p', { class: 'sim-rodape mono' });

  const desenhar = (): void => {
    const ordenadas = [...redes].sort((a, b) => b.rssi - a.rssi);
    rodape.textContent = `scan #${varreduras} · ${redes.length} ${L('redes', 'networks')} · ${L('próxima em 4 s', 'next in 4 s')}`;
    if (vista === 'redes') {
      trocar(
        corpo,
        h(
          'ul',
          { class: 'wifi-lista' },
          ...ordenadas.map((r) =>
            h(
              'li',
              { class: redes.indexOf(r) === escolhida ? 'ativa' : '', onclick: () => { escolhida = redes.indexOf(r); vista = 'sinal'; desenhar(); } },
              barras(r.rssi),
              h('span', { class: 'wifi-ssid' }, r.ssid),
              h('span', { class: 'mono' }, `ch ${r.canal}`),
              h('span', { class: 'mono' }, r.seg),
              h('span', { class: 'mono wifi-rssi' }, `${r.rssi} dBm`),
            ),
          ),
        ),
      );
    } else if (vista === 'canais') {
      const svg = s('svg', { class: 'wifi-canais', viewBox: '0 0 520 180' });
      for (let c = 1; c <= 13; c++) svg.append(s('text', { x: 20 + (c - 1) * 38, y: 172, class: 'eixo-texto' }, String(c)));
      for (const r of ordenadas) {
        const x = 20 + (r.canal - 1) * 38;
        const alt = Math.max(8, (r.rssi + 100) * 2.4);
        svg.append(s('path', { class: 'wifi-sino', d: `M${x - 76} 160 Q${x} ${160 - alt * 2} ${x + 76} 160` }), s('text', { x, y: 156 - alt, class: 'wifi-sino-rotulo', 'text-anchor': 'middle' }, r.ssid));
      }
      trocar(corpo, svg, h('p', { class: 'sim-nota' }, L('Cada rede ocupa ~22 MHz: só os canais 1, 6 e 11 não se sobrepõem.', 'Each network spans ~22 MHz: only channels 1, 6 and 11 do not overlap.')));
    } else {
      const r = redes[escolhida] ?? redes[0];
      if (!r) return;
      const pct = Math.max(0, Math.min(100, ((r.rssi + 100) / 70) * 100));
      const medidor = h('div', { class: 'medidor' }, h('span', { class: 'medidor-barra' }));
      medidor.style.setProperty('--pct', `${pct}%`);
      const mw = Math.pow(10, r.rssi / 10);
      trocar(
        corpo,
        h('div', { class: 'wifi-sinal' }, h('strong', {}, r.ssid), h('span', { class: 'wifi-grande mono' }, `${r.rssi} dBm`), medidor, h('span', {}, `${qualidade(r.rssi)} · ${mw.toExponential(1)} mW · ch ${r.canal}`)),
        h('div', { class: 'sim-chips' }, ...redes.map((x, i) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(i === escolhida), onclick: () => { escolhida = i; desenhar(); } }, x.ssid))),
      );
    }
  };

  relogio.intervalo(() => {
    for (const r of redes) r.rssi = Math.round(r.base + (Math.random() - 0.5) * 6);
    varreduras++;
    desenhar();
  }, 4000);
  desenhar();
  const el = quadroSim(
    'wifi-scan · WIFI_STA',
    abas([['redes', L('lista', 'list')], ['canais', L('canais', 'channels')], ['sinal', L('sinal', 'signal')]] as const, 'redes', (v) => { vista = v; desenhar(); }),
    corpo,
    rodape,
  );
  return { el, destruir: () => relogio.parar() };
};

interface Aparelho {
  readonly nome: string;
  readonly tipo: string;
  readonly mac: string;
  readonly angulo: number;
  readonly base: number;
  rssi: number;
}

export const simRadar = (): Simulador => {
  const relogio = new Relogio();
  const aparelhos: Aparelho[] = [
    { nome: 'Galaxy S23', tipo: L('celular', 'phone'), mac: '5C:3A:9F:12:7B:01', angulo: 40, base: -48, rssi: -48 },
    { nome: 'JBL Flip 6', tipo: L('caixa de som', 'speaker'), mac: 'F4:4E:FD:20:11:9A', angulo: 130, base: -58, rssi: -58 },
    { nome: 'Mi Band 7', tipo: L('pulseira', 'band'), mac: 'C8:0F:10:AA:31:54', angulo: 205, base: -65, rssi: -65 },
    { nome: 'MX Keys', tipo: L('teclado', 'keyboard'), mac: 'D2:81:7A:4C:0E:33', angulo: 300, base: -70, rssi: -70 },
    { nome: L('(sem nome)', '(no name)'), tipo: 'beacon', mac: '7E:12:66:C4:90:0B', angulo: 260, base: -79, rssi: -79 },
    { nome: 'TV Sala', tipo: 'TV', mac: '8C:79:F5:01:2D:E7', angulo: 95, base: -82, rssi: -82 },
    { nome: 'AirTag', tipo: L('rastreador', 'tracker'), mac: '4A:B1:02:FE:77:C1', angulo: 340, base: -87, rssi: -87 },
  ];
  let escolhido = 0;
  const svg = s('svg', { class: 'radar', viewBox: '0 0 300 300' });
  const detalhe = h('div', { class: 'radar-detalhe' });
  const raio = (rssi: number): number => 18 + Math.max(0, Math.min(1, (-40 - rssi) / 55)) * 122;
  const distancia = (rssi: number): number => Math.pow(10, (-59 - rssi) / 20);

  const desenhar = (): void => {
    svg.replaceChildren(
      ...[40, 80, 120, 140].map((r) => s('circle', { class: 'radar-anel', cx: 150, cy: 150, r })),
      s('line', { class: 'radar-anel', x1: 150, y1: 10, x2: 150, y2: 290 }),
      s('line', { class: 'radar-anel', x1: 10, y1: 150, x2: 290, y2: 150 }),
      s('g', { class: 'radar-varredura' }, s('path', { d: 'M150 150 L150 10 A140 140 0 0 1 249 51 Z' })),
      s('circle', { class: 'radar-centro', cx: 150, cy: 150, r: 5 }),
      ...aparelhos.map((a, i) => {
        const r = raio(a.rssi);
        const x = 150 + r * Math.cos((a.angulo * Math.PI) / 180);
        const y = 150 + r * Math.sin((a.angulo * Math.PI) / 180);
        const g = s('g', { class: `radar-ponto${i === escolhido ? ' ativo' : ''}`, tabindex: 0, role: 'button', 'aria-label': a.nome }, s('circle', { cx: x, cy: y, r: i === escolhido ? 7 : 5 }), s('text', { x: x + 9, y: y + 4 }, a.nome));
        g.addEventListener('click', () => { escolhido = i; desenhar(); });
        return g;
      }),
    );
    const a = aparelhos[escolhido];
    if (!a) return;
    trocar(
      detalhe,
      h('strong', {}, a.nome),
      h('dl', {}, h('dt', {}, 'MAC'), h('dd', { class: 'mono' }, a.mac), h('dt', {}, 'RSSI'), h('dd', { class: 'mono' }, `${a.rssi} dBm`), h('dt', {}, L('tipo', 'type')), h('dd', {}, a.tipo), h('dt', {}, L('distância', 'distance')), h('dd', { class: 'mono' }, `~${fmt(distancia(a.rssi))} m`)),
      h('p', { class: 'sim-nota' }, L('Estimativa por perda de caminho: paredes e corpos mudam muito o número.', 'Path-loss estimate: walls and bodies change it a lot.')),
    );
  };
  relogio.intervalo(() => {
    for (const a of aparelhos) a.rssi = Math.round(a.base + (Math.random() - 0.5) * 8);
    desenhar();
  }, 2000);
  desenhar();
  const el = quadroSim('radar-ble · active scan 5 s', h('div', { class: 'radar-corpo' }, svg, detalhe));
  return { el, destruir: () => relogio.parar() };
};
