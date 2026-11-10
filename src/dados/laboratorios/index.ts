import type { Laboratorio } from '../tipos';
import { LABS_ESP32 } from './esp32s3';
import { LABS_OUTROS } from './outros';

export const LABORATORIOS: readonly Laboratorio[] = [...LABS_ESP32, ...LABS_OUTROS];

const PORID = new Map(LABORATORIOS.map((l) => [l.id, l]));

export const labPorId = (id: string | null | undefined): Laboratorio | undefined => (id ? PORID.get(id) : undefined);

export const labsDaPlaca = (placa: string): Laboratorio[] => LABORATORIOS.filter((l) => l.placa === placa).sort((a, b) => a.numero - b.numero);
