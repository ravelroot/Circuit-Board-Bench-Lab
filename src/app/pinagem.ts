import type { ModuloBancada, PlacaBancada } from '../dados/bancada3d';
import { placaPorId } from '../dados/placas';
import { projetoDe } from '../pcb/gerador';

export interface PinoFisico {
  readonly chave: string;
  readonly nome: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const nomeBase = (chave: string): string => chave.split('·')[0] ?? chave;

const cache = new Map<string, readonly PinoFisico[]>();

export const pinosDaPlaca = (pb: PlacaBancada): readonly PinoFisico[] => {
  const pronto = cache.get(pb.id);
  if (pronto) return pronto;
  const placa = placaPorId(pb.id);
  if (!placa) return [];
  const projeto = projetoDe(placa);
  const cabecalhos = projeto.footprints.filter((f) => f.modelo === 'barra' || f.modelo === 'femea' || (f.modelo === 'pads' && f.parte === 'pinos'));
  const vistos = new Map<string, number>();
  const pinos: PinoFisico[] = [];
  cabecalhos.forEach((f, i) => {
    const nomes = pb.cabecalhos[i];
    if (!nomes) return;
    f.pads.forEach((pad, j) => {
      const nome = nomes[j];
      if (!nome) return;
      const n = (vistos.get(nome) ?? 0) + 1;
      vistos.set(nome, n);
      pinos.push({ chave: n === 1 ? nome : `${nome}·${n}`, nome, x: pad.x, y: pad.y, z: f.modelo === 'pads' ? 0.3 : 8.5 });
    });
  });
  cache.set(pb.id, pinos);
  return pinos;
};

export const pinosDoModulo = (m: ModuloBancada): readonly string[] => m.pinos.map((p) => p.nome);
