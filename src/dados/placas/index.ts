import type { Placa } from '../tipos';
import { ATX, DDR5, FONTE_ATX, GPU, MINI_ITX, SSD } from './pc';
import { LM386, LM7805, NE555, RETIFICADOR } from './circuitos';
import { PI5, PI_ZERO } from './computadores';
import { BLUEPILL, ESP32_CAM, ESP32_S3, MEGA, MICROBIT, NANO, NODEMCU, PICO, UNO_R3, XIAO_C3 } from './microcontroladores';
import { A4988, HCSR04, L298N, LM2596, MPU6050, NEO6M, OLED, RC522, RELE, TP4056 } from './modulos';

export const PLACAS: readonly Placa[] = [
  ESP32_S3,
  UNO_R3,
  PICO,
  NANO,
  MEGA,
  NODEMCU,
  ESP32_CAM,
  BLUEPILL,
  XIAO_C3,
  MICROBIT,
  PI5,
  PI_ZERO,
  ATX,
  MINI_ITX,
  GPU,
  SSD,
  DDR5,
  FONTE_ATX,
  L298N,
  RELE,
  HCSR04,
  RC522,
  A4988,
  LM2596,
  TP4056,
  MPU6050,
  OLED,
  NEO6M,
  NE555,
  LM7805,
  LM386,
  RETIFICADOR,
];

const PORID = new Map(PLACAS.map((p) => [p.id, p]));

export const placaPorId = (id: string | null | undefined): Placa | undefined => (id ? PORID.get(id) : undefined);
