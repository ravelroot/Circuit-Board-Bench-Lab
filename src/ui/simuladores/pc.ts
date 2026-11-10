import type { CenarioPost } from '../../dados/tipos';
import { h, trocar } from '../dom';
import { L, quadroSim, Relogio, type Simulador } from './base';

export const simMemoria = (): Simulador => {
  const slots = ['A1', 'A2', 'B1', 'B2'] as const;
  const ocupados = new Set<string>(['A2', 'B2']);
  const corpo = h('div', { class: 'memoria-slots' });
  const resultado = h('div', { class: 'memoria-resultado' });
  const desenhar = (): void => {
    trocar(
      corpo,
      h('span', { class: 'memoria-cpu mono' }, 'CPU'),
      ...slots.map((sl) =>
        h('button', { class: `memoria-slot${ocupados.has(sl) ? ' cheio' : ''}${sl.startsWith('A') ? ' canal-a' : ' canal-b'}`, type: 'button', 'aria-pressed': String(ocupados.has(sl)), onclick: () => { if (ocupados.has(sl)) ocupados.delete(sl); else ocupados.add(sl); desenhar(); } }, h('span', { class: 'mono' }, sl)),
      ),
    );
    const a = [...ocupados].filter((x) => x.startsWith('A')).length;
    const b = [...ocupados].filter((x) => x.startsWith('B')).length;
    const n = ocupados.size;
    const dual = a > 0 && b > 0;
    const ideal = n === 2 && ocupados.has('A2') && ocupados.has('B2');
    const banda = n === 0 ? 0 : dual ? 96 : 48;
    trocar(
      resultado,
      h('strong', {}, n === 0 ? L('Sem memória: a placa não passa do LED DRAM.', 'No memory: the board stops at the DRAM LED.') : dual ? 'Dual channel' : 'Single channel'),
      h('p', { class: 'mono' }, `${n} × 16 GB = ${n * 16} GB · DDR5-6000 · ~${banda} GB/s`),
      h('p', { class: 'sim-nota' }, n === 2 && !ideal ? (dual ? L('Funciona, mas o manual recomenda A2 e B2.', 'It works, but the manual recommends A2 and B2.') : L('Os dois no mesmo canal: metade da banda.', 'Both in the same channel: half the bandwidth.')) : n === 4 ? L('Quatro pentes: dual channel, mas o clock máximo costuma cair.', 'Four sticks: dual channel, but max clock usually drops.') : ideal ? L('Configuração ideal para dois pentes.', 'The ideal layout for two sticks.') : ''),
    );
  };
  desenhar();
  return { el: quadroSim('DIMM · 2 × 2 slots', corpo, resultado), destruir: () => undefined };
};

const ETAPAS = ['cpu', 'dram', 'vga', 'boot'] as const;

export const simPost = (inicial: CenarioPost): Simulador => {
  const relogio = new Relogio();
  let cenario: CenarioPost = inicial;
  const leds = ETAPAS.map((e) => h('span', { class: `post-led post-${e}` }, h('i', {}), h('span', { class: 'mono' }, e.toUpperCase())));
  const mensagem = h('p', { class: 'post-mensagem' });
  const tela = h('div', { class: 'post-tela mono' });
  const nomes: Record<CenarioPost, string> = {
    ok: L('tudo certo', 'all good'),
    cpu: L('EPS desligado', 'EPS unplugged'),
    dram: L('memória mal encaixada', 'memory not seated'),
    vga: L('sem vídeo', 'no video'),
    boot: L('sem disco de boot', 'no boot drive'),
  };
  const textos: Record<CenarioPost, string> = {
    ok: L('POST concluído: a BIOS aparece no monitor.', 'POST complete: the BIOS shows on the monitor.'),
    cpu: L('Travou no CPU: confira o cabo EPS de 8 pinos e o encaixe do processador.', 'Stuck on CPU: check the 8-pin EPS cable and the CPU seating.'),
    dram: L('Travou na DRAM: reencaixe os pentes em A2 e B2 até as travas clicarem.', 'Stuck on DRAM: reseat the sticks in A2 and B2 until the latches click.'),
    vga: L('Travou no VGA: ligue o monitor na placa de vídeo ou confira o encaixe dela.', 'Stuck on VGA: plug the monitor into the GPU or reseat it.'),
    boot: L('Travou no BOOT: nenhum disco com sistema. Entre na BIOS e confira o SSD.', 'Stuck on BOOT: no drive with a system. Enter the BIOS and check the SSD.'),
  };
  const ligar = (): void => {
    relogio.limparTempos();
    for (const l of leds) l.className = l.className.replace(/ (acesa|ok)/g, '');
    mensagem.textContent = L('Ligando...', 'Powering on...');
    tela.textContent = '';
    const parada = ETAPAS.indexOf(cenario as (typeof ETAPAS)[number]);
    let t = 300;
    ETAPAS.forEach((e, i) => {
      const led = leds[i];
      if (!led) return;
      if (parada >= 0 && i > parada) return;
      relogio.depois(() => { led.classList.add('acesa'); mensagem.textContent = `${e.toUpperCase()}...`; }, t);
      t += e === 'dram' ? 1800 : 700;
      if (parada === i) {
        relogio.depois(() => { mensagem.textContent = textos[cenario]; tela.textContent = L('sem sinal', 'no signal'); }, t);
        return;
      }
      relogio.depois(() => { led.classList.remove('acesa'); led.classList.add('ok'); }, t);
    });
    if (parada < 0) relogio.depois(() => { mensagem.textContent = textos.ok; tela.textContent = 'UEFI BIOS · DEL / F2'; }, t + 200);
  };
  const seletor = h('select', { class: 'campo', 'aria-label': L('cenário', 'scenario') }, ...(Object.keys(nomes) as CenarioPost[]).map((c) => h('option', { value: c, selected: c === cenario }, nomes[c])));
  seletor.addEventListener('change', () => { cenario = seletor.value as CenarioPost; ligar(); });
  const el = quadroSim(
    'POST · debug LEDs',
    h('div', { class: 'sim-chips' }, h('button', { class: 'botao', type: 'button', onclick: ligar }, L('Ligar (PWR_SW)', 'Power on (PWR_SW)')), seletor),
    h('div', { class: 'post-corpo' }, h('div', { class: 'post-leds' }, ...leds), tela),
    mensagem,
  );
  relogio.depois(ligar, 400);
  return { el, destruir: () => relogio.parar() };
};
