import type { Previa } from '../../dados/tipos';
import { simMicrofone, simSintetizador } from './audio';
import type { Simulador } from './base';
import { simMemoria, simPost } from './pc';
import { simRadar, simWifi } from './radio';
import { simRfid } from './rfid';
import { simSerial } from './serial';
import { simDistancia, simPonteH, simPwm, simRegulador, simServo, simTimer555 } from './sinais';
import { simPinagem, simTela } from './telas';

export type { Simulador } from './base';

export const montarPrevia = (p: Previa): Simulador => {
  switch (p.tipo) {
    case 'serial':
      return simSerial(p);
    case 'wifi':
      return simWifi();
    case 'radar':
      return simRadar();
    case 'sintetizador':
      return simSintetizador();
    case 'rfid':
      return simRfid();
    case 'microfone':
      return simMicrofone();
    case 'tela':
      return simTela(p);
    case 'pwm':
      return simPwm(p);
    case 'servo':
      return simServo();
    case 'distancia':
      return simDistancia();
    case 'pinagem':
      return simPinagem();
    case 'memoria':
      return simMemoria();
    case 'post':
      return simPost(p.cenario);
    case 'timer555':
      return simTimer555();
    case 'regulador':
      return simRegulador();
    case 'ponteh':
      return simPonteH();
  }
};
