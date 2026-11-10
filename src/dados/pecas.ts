import { t } from './base';
import type { Peca } from './tipos';

export const PECAS: readonly Peca[] = [
  { id: 'protoboard', nome: t('Protoboard e jumpers', 'Breadboard and jumpers') },
  { id: 'led-resistor', nome: t('LED e resistor de 220 Ω', 'LED and 220 Ω resistor') },
  { id: 'botao', nome: t('Botão de pressão', 'Push button') },
  { id: 'potenciometro', nome: t('Potenciômetro de 10 kΩ', '10 kΩ potentiometer') },
  { id: 'tela-st7789', nome: t('Tela ST7789 de 1,9"', '1.9" ST7789 screen') },
  { id: 'lcd-i2c', nome: t('LCD 16×2 com I²C', '16×2 LCD with I²C') },
  { id: 'rc522', nome: t('Leitor RC522 e cartão MIFARE', 'RC522 reader and MIFARE card') },
  { id: 'inmp441', nome: t('Microfone I²S INMP441', 'INMP441 I²S microphone') },
  { id: 'ky037', nome: t('Microfone analógico KY-037', 'KY-037 analog microphone') },
  { id: 'max98357a', nome: t('Amplificador MAX98357A e alto-falante', 'MAX98357A amp and speaker') },
  { id: 'rede-wifi', nome: t('Rede Wi-Fi de 2,4 GHz', '2.4 GHz Wi-Fi network') },
  { id: 'celular-ble', nome: t('Celular com Bluetooth', 'Phone with Bluetooth') },
  { id: 'servo-sg90', nome: t('Servo SG90', 'SG90 servo') },
  { id: 'hcsr04', nome: t('Sensor ultrassônico HC-SR04', 'HC-SR04 ultrasonic sensor') },
  { id: 'microsd', nome: t('Cartão microSD de 32 GB', '32 GB microSD card') },
  { id: 'fonte-27w', nome: t('Fonte USB-C de 27 W', '27 W USB-C supply') },
  { id: 'pc-imager', nome: t('Computador com Raspberry Pi Imager', 'Computer with Raspberry Pi Imager') },
  { id: 'ram-ddr5', nome: t('Dois pentes DDR5', 'Two DDR5 sticks') },
  { id: 'cpu-am5', nome: t('Processador AM5 e cooler', 'AM5 CPU and cooler') },
  { id: 'fonte-atx', nome: t('Fonte ATX', 'ATX power supply') },
  { id: 'monitor', nome: t('Monitor e cabo de vídeo', 'Monitor and video cable') },
  { id: 'chave-fenda', nome: t('Chave de fenda Phillips', 'Phillips screwdriver') },
  { id: 'multimetro', nome: t('Multímetro', 'Multimeter') },
  { id: 'fonte-9v', nome: t('Fonte de 9 a 12 V', '9 to 12 V supply') },
  { id: 'motor-dc', nome: t('Motor DC de 6 a 12 V', '6 to 12 V DC motor') },
  { id: 'arduino', nome: t('Arduino Uno ou similar', 'Arduino Uno or similar') },
];

const PORID = new Map(PECAS.map((p) => [p.id, p]));

export const pecaPorId = (id: string): Peca | undefined => PORID.get(id);
