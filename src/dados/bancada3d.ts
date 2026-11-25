import { t } from './base';
import type { Texto } from './tipos';

export interface PlacaBancada {
  readonly id: string;
  readonly familia: 'arduino' | 'esp32' | 'esp8266' | 'rp2040' | 'stm32' | 'pi';
  readonly logica: '5 V' | '3,3 V';
  readonly cabecalhos: readonly (readonly string[] | null)[];
}

const faixa = (prefixo: string, de: number, ate: number): string[] => {
  const passo = de <= ate ? 1 : -1;
  const lista: string[] = [];
  for (let i = de; passo > 0 ? i <= ate : i >= ate; i += passo) lista.push(`${prefixo}${i}`);
  return lista;
};

const PODER_UNO = ['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND', 'VIN'];
const ICSP = ['MISO', '5V', 'SCK', 'MOSI', 'RESET', 'GND'];

export const PLACAS_BANCADA: readonly PlacaBancada[] = [
  {
    id: 'uno-r3',
    familia: 'arduino',
    logica: '5 V',
    cabecalhos: [['SCL', 'SDA', 'AREF', 'GND', ...faixa('D', 13, 0)], PODER_UNO, faixa('A', 0, 5), ICSP],
  },
  {
    id: 'nano',
    familia: 'arduino',
    logica: '5 V',
    cabecalhos: [
      [...faixa('D', 12, 2), 'GND', 'RESET', 'D0', 'D1'],
      ['D13', '3V3', 'AREF', ...faixa('A', 0, 7), '5V', 'RESET', 'GND', 'VIN'],
      ICSP,
    ],
  },
  {
    id: 'mega2560',
    familia: 'arduino',
    logica: '5 V',
    cabecalhos: [
      ['SCL', 'SDA', 'AREF', 'GND', ...faixa('D', 13, 0), ...faixa('D', 14, 21)],
      PODER_UNO,
      faixa('A', 0, 15),
      ['5V', '5V', ...faixa('D', 22, 53), 'GND', 'GND'],
      ICSP,
    ],
  },
  {
    id: 'esp32-devkitc',
    familia: 'esp32',
    logica: '3,3 V',
    cabecalhos: [
      ['5V', 'CMD', 'SD3', 'SD2', 'GPIO13', 'GND', 'GPIO12', 'GPIO14', 'GPIO27', 'GPIO26', 'GPIO25', 'GPIO33', 'GPIO32', 'GPIO35', 'GPIO34', 'VN', 'VP', 'EN', '3V3'],
      ['CLK', 'SD0', 'SD1', 'GPIO15', 'GPIO2', 'GPIO0', 'GPIO4', 'GPIO16', 'GPIO17', 'GPIO5', 'GPIO18', 'GPIO19', 'GND', 'GPIO21', 'RX0', 'TX0', 'GPIO22', 'GPIO23', 'GND'],
    ],
  },
  {
    id: 'nodemcu',
    familia: 'esp8266',
    logica: '3,3 V',
    cabecalhos: [
      ['3V3', 'GND', 'TX', 'RX', 'D8', 'D7', 'D6', 'D5', 'GND', '3V3', 'D4', 'D3', 'D2', 'D1', 'D0'],
      ['VIN', 'GND', 'RST', 'EN', '3V3', 'GND', 'CLK', 'SD0', 'CMD', 'SD1', 'SD2', 'SD3', 'RSV', 'RSV', 'A0'],
    ],
  },
  {
    id: 'pico',
    familia: 'rp2040',
    logica: '3,3 V',
    cabecalhos: [
      ['VBUS', 'VSYS', 'GND', '3V3_EN', '3V3', 'ADC_VREF', 'GP28', 'AGND', 'GP27', 'GP26', 'RUN', 'GP22', 'GND', 'GP21', 'GP20', 'GP19', 'GP18', 'GND', 'GP17'],
      ['GP0', 'GP1', 'GND', 'GP2', 'GP3', 'GP4', 'GP5', 'GND', 'GP6', 'GP7', 'GP8', 'GP9', 'GND', 'GP10', 'GP11', 'GP12', 'GP13', 'GND', 'GP14'],
    ],
  },
  {
    id: 'bluepill',
    familia: 'stm32',
    logica: '3,3 V',
    cabecalhos: [
      ['PB12', 'PB13', 'PB14', 'PB15', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA15', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7', 'PB8', 'PB9', '5V', 'GND', '3V3'],
      ['VBAT', 'PC13', 'PC14', 'PC15', 'PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1', 'PB10', 'PB11', 'RESET', '3V3', 'GND', 'GND'],
      ['3V3', 'SWDIO', 'SWCLK', 'GND'],
      null,
    ],
  },
  {
    id: 'pi4',
    familia: 'pi',
    logica: '3,3 V',
    cabecalhos: [
      [
        '5V', '5V', 'GND', 'GPIO14', 'GPIO15', 'GPIO18', 'GND', 'GPIO23', 'GPIO24', 'GND', 'GPIO25', 'GPIO8', 'GPIO7', 'GPIO1', 'GND', 'GPIO12', 'GND', 'GPIO16', 'GPIO20', 'GPIO21',
        '3V3', 'GPIO2', 'GPIO3', 'GPIO4', 'GND', 'GPIO17', 'GPIO27', 'GPIO22', '3V3', 'GPIO10', 'GPIO9', 'GPIO11', 'GND', 'GPIO0', 'GPIO5', 'GPIO6', 'GPIO13', 'GPIO19', 'GPIO26', 'GND',
      ],
      null,
    ],
  },
];

export const placaBancada = (id: string): PlacaBancada | undefined => PLACAS_BANCADA.find((p) => p.id === id);

export type TipoModulo = 'led' | 'rgb' | 'buzzer' | 'oled' | 'botao' | 'pot' | 'hcsr04' | 'dht11' | 'ldr' | 'servo' | 'motor';

export type GrupoModulo = 'saida' | 'entrada' | 'sensor' | 'atuador';

export type Requisito = 'gnd' | 'vcc' | 'digital' | 'pwm' | 'analogico' | 'sda' | 'scl';

export interface PinoModulo {
  readonly nome: string;
  readonly precisa: Requisito;
}

export interface ModuloBancada {
  readonly tipo: TipoModulo;
  readonly nome: Texto;
  readonly resumo: Texto;
  readonly grupo: GrupoModulo;
  readonly largura: number;
  readonly profundidade: number;
  readonly pinos: readonly PinoModulo[];
}

const p = (nome: string, precisa: Requisito): PinoModulo => ({ nome, precisa });

export const MODULOS: readonly ModuloBancada[] = [
  { tipo: 'led', grupo: 'saida', nome: t('Módulo LED de 5 mm', '5 mm LED module'), resumo: t('Acende quando o pino vai a HIGH.', 'Lights up when its pin goes HIGH.'), largura: 18, profundidade: 22, pinos: [p('SIG', 'digital'), p('GND', 'gnd')] },
  { tipo: 'rgb', grupo: 'saida', nome: t('Módulo LED RGB', 'RGB LED module'), resumo: t('Três LEDs numa lente: mistura qualquer cor.', 'Three LEDs in one lens: mixes any colour.'), largura: 22, profundidade: 22, pinos: [p('R', 'pwm'), p('G', 'pwm'), p('B', 'pwm'), p('GND', 'gnd')] },
  { tipo: 'buzzer', grupo: 'saida', nome: t('Módulo buzzer piezo', 'Piezo buzzer module'), resumo: t('Apita e toca melodias simples.', 'Beeps and plays simple melodies.'), largura: 20, profundidade: 22, pinos: [p('SIG', 'digital'), p('GND', 'gnd')] },
  { tipo: 'oled', grupo: 'saida', nome: t('Tela OLED de 0,96" (SSD1306)', '0.96" OLED display (SSD1306)'), resumo: t('Telinha I²C de 128 × 64 pixels.', 'Tiny 128 × 64 pixel I²C screen.'), largura: 27, profundidade: 28, pinos: [p('GND', 'gnd'), p('VCC', 'vcc'), p('SCL', 'scl'), p('SDA', 'sda')] },
  { tipo: 'botao', grupo: 'entrada', nome: t('Módulo botão', 'Push-button module'), resumo: t('Apertou: a saída vai a HIGH.', 'Press it: OUT goes HIGH.'), largura: 20, profundidade: 22, pinos: [p('OUT', 'digital'), p('VCC', 'vcc'), p('GND', 'gnd')] },
  { tipo: 'pot', grupo: 'entrada', nome: t('Potenciômetro de 10 kΩ', '10 kΩ potentiometer'), resumo: t('Um botão que gira de 0 V a VCC.', 'A knob that sweeps 0 V to VCC.'), largura: 22, profundidade: 24, pinos: [p('VCC', 'vcc'), p('OUT', 'analogico'), p('GND', 'gnd')] },
  { tipo: 'hcsr04', grupo: 'sensor', nome: t('Sensor ultrassônico HC-SR04', 'HC-SR04 ultrasonic sensor'), resumo: t('Mede distância pelo eco do som.', 'Measures distance with sound echoes.'), largura: 45, profundidade: 22, pinos: [p('VCC', 'vcc'), p('TRIG', 'digital'), p('ECHO', 'digital'), p('GND', 'gnd')] },
  { tipo: 'dht11', grupo: 'sensor', nome: t('Sensor de temperatura e umidade DHT11', 'DHT11 temperature & humidity'), resumo: t('Lê temperatura e umidade do ar.', 'Reads air temperature and humidity.'), largura: 24, profundidade: 26, pinos: [p('DATA', 'digital'), p('VCC', 'vcc'), p('GND', 'gnd')] },
  { tipo: 'ldr', grupo: 'sensor', nome: t('Módulo fotorresistor (LDR)', 'Photoresistor (LDR) module'), resumo: t('Sente o quanto a luz está forte.', 'Senses how bright the light is.'), largura: 20, profundidade: 22, pinos: [p('OUT', 'analogico'), p('VCC', 'vcc'), p('GND', 'gnd')] },
  { tipo: 'servo', grupo: 'atuador', nome: t('Micro servo SG90', 'SG90 micro servo'), resumo: t('Gira para o ângulo que você pedir.', 'Turns to the angle you ask for.'), largura: 34, profundidade: 26, pinos: [p('SIG', 'pwm'), p('VCC', 'vcc'), p('GND', 'gnd')] },
  { tipo: 'motor', grupo: 'atuador', nome: t('Motor TT com driver', 'TT gear motor with driver'), resumo: t('Motor com redução e roda.', 'Geared motor that drives a wheel.'), largura: 70, profundidade: 30, pinos: [p('IN', 'digital'), p('VCC', 'vcc'), p('GND', 'gnd')] },
];

export const moduloPorTipo = (tipo: string): ModuloBancada | undefined => MODULOS.find((m) => m.tipo === tipo);

export interface LigacaoMissao {
  readonly modulo: TipoModulo;
  readonly pino: string;
  readonly alvo: string;
  readonly nota: Texto;
}

export interface Missao {
  readonly id: string;
  readonly titulo: Texto;
  readonly nivel: 'iniciante' | 'intermediario';
  readonly minutos: number;
  readonly placa: string;
  readonly resumo: Texto;
  readonly ligacoes: readonly LigacaoMissao[];
  readonly aprende: readonly Texto[];
  readonly dicaRodar: Texto;
  readonly codigo: string;
}

const l = (modulo: TipoModulo, pino: string, alvo: string, pt: string, en: string): LigacaoMissao => ({ modulo, pino, alvo, nota: t(pt, en) });

const GND_LED = l('led', 'GND', 'GND', 'Fecha o circuito: a corrente volta para a placa.', 'Closes the loop: current flows back to the board.');

export const MISSOES: readonly Missao[] = [
  {
    id: 'ola-led',
    titulo: t('Olá, LED', 'Hello, LED'),
    nivel: 'iniciante',
    minutos: 3,
    placa: 'uno-r3',
    resumo: t(
      'Todo maker começa aqui: piscar um LED é o "Olá, mundo" da eletrônica. Você liga um LED ao Arduino Uno e acende e apaga, sem parar. Dois fios e poucas linhas de código.',
      'Every maker starts here: blinking an LED is the "Hello, world" of electronics. You hook one LED to an Arduino Uno and switch it on and off, forever. Two wires and a few lines of code.',
    ),
    ligacoes: [l('led', 'SIG', 'D13', 'D13 é o pino que o sketch liga e desliga entre 0 V e 5 V. Ele também acende o LED "L" da placa.', 'D13 is the pin the sketch switches between 0 V and 5 V. It also drives the tiny "L" LED on the board.'), GND_LED],
    aprende: [
      t('Um pino digital é uma chave: o sketch alterna entre 0 V (LOW) e 5 V (HIGH).', 'A digital pin is a switch: the sketch flips it between 0 V (LOW) and 5 V (HIGH).'),
      t('A corrente só passa num circuito fechado: sai do pino, atravessa o LED e volta ao GND.', 'Current only flows in a closed loop: out of the pin, through the LED, back to GND.'),
      t('Todo LED precisa de um resistor para limitar a corrente; este módulo já traz um.', 'An LED always needs a resistor to limit current; this module has one on board.'),
      t('delay(500) pausa o sketch por meio segundo.', 'delay(500) pauses the sketch for half a second.'),
    ],
    dicaRodar: t('Repare no LED "L" da placa piscando junto com o seu, e acompanhe as linhas HIGH e LOW na aba Serial.', 'Spot the tiny "L" LED on the Uno blinking with yours, and follow the HIGH / LOW lines in the Serial tab.'),
    codigo: `const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("D13 HIGH - LED aceso");
  delay(500);

  digitalWrite(LED_PIN, LOW);
  Serial.println("D13 LOW - LED apagado");
  delay(500);
}
`,
  },
  {
    id: 'botao-led',
    titulo: t('Botão que acende', 'Button lamp'),
    nivel: 'iniciante',
    minutos: 5,
    placa: 'uno-r3',
    resumo: t('Agora a placa escuta: enquanto o botão estiver apertado, o LED acende. É o começo de qualquer interface.', 'Now the board listens: while the button is held, the LED lights up. It is the start of every interface.'),
    ligacoes: [
      l('botao', 'OUT', 'D2', 'D2 lê se o botão está apertado (HIGH) ou solto (LOW).', 'D2 reads whether the button is pressed (HIGH) or released (LOW).'),
      l('botao', 'VCC', '5V', 'O módulo precisa de 5 V para mandar o HIGH.', 'The module needs 5 V to send HIGH.'),
      l('botao', 'GND', 'GND', 'Referência de 0 V do módulo.', 'The module 0 V reference.'),
      l('led', 'SIG', 'D13', 'O LED segue o botão.', 'The LED follows the button.'),
      GND_LED,
    ],
    aprende: [
      t('digitalRead() devolve HIGH ou LOW conforme a tensão no pino.', 'digitalRead() returns HIGH or LOW from the pin voltage.'),
      t('Um if transforma uma leitura numa decisão.', 'An if turns a reading into a decision.'),
      t('Os módulos de botão já trazem o resistor de pull-down.', 'Button modules already include the pull-down resistor.'),
    ],
    dicaRodar: t('Segure o botão (no 3D ou em Controles) e veja o LED acender.', 'Hold the button (in 3D or under Controls) and watch the LED light up.'),
    codigo: `const int BOTAO = 2;
const int LED_PIN = 13;

void setup() {
  pinMode(BOTAO, INPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int apertado = digitalRead(BOTAO);
  digitalWrite(LED_PIN, apertado);
  Serial.println(apertado ? "apertado" : "solto");
  delay(50);
}
`,
  },
  {
    id: 'dimmer',
    titulo: t('Dimmer com potenciômetro', 'Knob dimmer'),
    nivel: 'iniciante',
    minutos: 5,
    placa: 'uno-r3',
    resumo: t('Gire o potenciômetro e o LED fica mais forte ou mais fraco. Você vai ler um valor analógico e responder com PWM.', 'Turn the knob and the LED gets brighter or dimmer. You read an analog value and answer with PWM.'),
    ligacoes: [
      l('pot', 'OUT', 'A0', 'A0 mede a tensão do cursor: de 0 a 1023.', 'A0 measures the wiper voltage: 0 to 1023.'),
      l('pot', 'VCC', '5V', 'Uma ponta do potenciômetro vai a 5 V.', 'One end of the pot goes to 5 V.'),
      l('pot', 'GND', 'GND', 'A outra ponta vai a 0 V.', 'The other end goes to 0 V.'),
      l('led', 'SIG', 'D9', 'D9 tem PWM (~): liga e desliga tão rápido que parece meia-luz.', 'D9 has PWM (~): it switches so fast it looks like half light.'),
      GND_LED,
    ],
    aprende: [
      t('analogRead() converte 0–5 V em 0–1023.', 'analogRead() turns 0–5 V into 0–1023.'),
      t('analogWrite() gera PWM de 0 a 255 nos pinos com ~.', 'analogWrite() makes 0–255 PWM on the ~ pins.'),
      t('map() converte uma faixa de números em outra.', 'map() converts one number range into another.'),
    ],
    dicaRodar: t('Arraste o controle do potenciômetro e veja o brilho mudar.', 'Drag the potentiometer control and watch the brightness change.'),
    codigo: `const int POT = A0;
const int LED_PIN = 9;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int leitura = analogRead(POT);
  int brilho = map(leitura, 0, 1023, 0, 255);
  analogWrite(LED_PIN, brilho);
  Serial.print("A0 = ");
  Serial.print(leitura);
  Serial.print(" -> PWM ");
  Serial.println(brilho);
  delay(100);
}
`,
  },
  {
    id: 'melodia',
    titulo: t('Melodia no buzzer', 'Buzzer melody'),
    nivel: 'iniciante',
    minutos: 4,
    placa: 'uno-r3',
    resumo: t('tone() faz o pino vibrar numa frequência: com uma lista de notas, o buzzer toca uma escala.', 'tone() makes a pin vibrate at a frequency: with a list of notes, the buzzer plays a scale.'),
    ligacoes: [
      l('buzzer', 'SIG', 'D8', 'D8 recebe a onda quadrada que vira som.', 'D8 gets the square wave that becomes sound.'),
      l('buzzer', 'GND', 'GND', 'Volta da corrente.', 'Current return.'),
    ],
    aprende: [
      t('Som é vibração: 440 Hz é o Lá central.', 'Sound is vibration: 440 Hz is the A above middle C.'),
      t('tone(pino, frequência, duração) não trava o sketch.', 'tone(pin, frequency, duration) does not block the sketch.'),
      t('Listas (arrays) guardam várias notas em ordem.', 'Arrays store several notes in order.'),
    ],
    dicaRodar: t('Ligue o som na barra para ouvir as notas.', 'Turn sound on in the toolbar to hear the notes.'),
    codigo: `const int BUZZER = 8;
int notas[] = {262, 294, 330, 349, 392, 440, 494, 523};

void setup() {
  Serial.begin(9600);
}

void loop() {
  for (int i = 0; i < 8; i++) {
    tone(BUZZER, notas[i], 220);
    Serial.println(notas[i]);
    delay(250);
  }
  delay(600);
}
`,
  },
  {
    id: 'servo',
    titulo: t('Varredura do servo', 'Servo sweep'),
    nivel: 'intermediario',
    minutos: 6,
    placa: 'uno-r3',
    resumo: t('O servo vai de 0° a 180° e volta. A biblioteca Servo traduz o ângulo em pulsos de 1 a 2 ms.', 'The servo goes from 0° to 180° and back. The Servo library turns the angle into 1 to 2 ms pulses.'),
    ligacoes: [
      l('servo', 'SIG', 'D9', 'O fio laranja leva os pulsos de controle.', 'The orange wire carries the control pulses.'),
      l('servo', 'VCC', '5V', 'O servo pede 5 V para o motor.', 'The servo needs 5 V for its motor.'),
      l('servo', 'GND', 'GND', 'Terra comum com a placa.', 'Common ground with the board.'),
    ],
    aprende: [
      t('Um servo tem motor, engrenagens e um sensor de posição.', 'A servo has a motor, gears and a position sensor.'),
      t('A largura do pulso define o ângulo.', 'The pulse width sets the angle.'),
      t('Motores maiores pedem fonte separada, com GND comum.', 'Bigger motors need a separate supply with a common GND.'),
    ],
    dicaRodar: t('Veja o braço branco do servo varrer de um lado a outro.', 'Watch the white servo horn sweep from side to side.'),
    codigo: `#include <Servo.h>

Servo braco;

void setup() {
  braco.attach(9);
  Serial.begin(9600);
}

void loop() {
  for (int a = 0; a <= 180; a += 2) {
    braco.write(a);
    delay(15);
  }
  for (int a = 180; a >= 0; a -= 2) {
    braco.write(a);
    delay(15);
  }
  Serial.println("varredura completa");
}
`,
  },
  {
    id: 'regua',
    titulo: t('Régua ultrassônica', 'Ultrasonic ruler'),
    nivel: 'intermediario',
    minutos: 8,
    placa: 'uno-r3',
    resumo: t('O HC-SR04 grita um ultrassom e cronometra o eco. Com a velocidade do som, a placa calcula a distância.', 'The HC-SR04 chirps ultrasound and times the echo. With the speed of sound, the board works out the distance.'),
    ligacoes: [
      l('hcsr04', 'TRIG', 'D9', 'Um pulso de 10 µs em TRIG dispara a medida.', 'A 10 µs pulse on TRIG starts a reading.'),
      l('hcsr04', 'ECHO', 'D10', 'ECHO fica em HIGH pelo tempo de ida e volta.', 'ECHO stays HIGH for the round-trip time.'),
      l('hcsr04', 'VCC', '5V', 'O sensor trabalha com 5 V.', 'The sensor runs on 5 V.'),
      l('hcsr04', 'GND', 'GND', 'Terra comum.', 'Common ground.'),
    ],
    aprende: [
      t('pulseIn() mede quanto tempo um pino fica em HIGH.', 'pulseIn() measures how long a pin stays HIGH.'),
      t('Distância = tempo × 0,0343 / 2 (ida e volta).', 'Distance = time × 0.0343 / 2 (there and back).'),
      t('Superfícies macias absorvem o som e erram a leitura.', 'Soft surfaces absorb sound and spoil the reading.'),
    ],
    dicaRodar: t('Mova o controle de distância e acompanhe a Serial.', 'Move the distance control and follow the Serial tab.'),
    codigo: `const int TRIG = 9;
const int ECHO = 10;

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long tempo = pulseIn(ECHO, HIGH);
  float cm = tempo * 0.0343 / 2;
  Serial.print("Distancia: ");
  Serial.print(cm);
  Serial.println(" cm");
  delay(200);
}
`,
  },
  {
    id: 'termometro',
    titulo: t('Termômetro DHT11', 'DHT11 thermometer'),
    nivel: 'intermediario',
    minutos: 6,
    placa: 'uno-r3',
    resumo: t('O DHT11 manda temperatura e umidade por um único fio de dados, num protocolo próprio.', 'The DHT11 sends temperature and humidity over a single data wire, with its own protocol.'),
    ligacoes: [
      l('dht11', 'DATA', 'D2', 'Um fio só leva os 40 bits de cada leitura.', 'One wire carries the 40 bits of each reading.'),
      l('dht11', 'VCC', '5V', 'Alimentação do sensor.', 'Sensor power.'),
      l('dht11', 'GND', 'GND', 'Terra comum.', 'Common ground.'),
    ],
    aprende: [
      t('Bibliotecas escondem protocolos complicados atrás de uma função.', 'Libraries hide tricky protocols behind one function.'),
      t('O DHT11 só aceita uma leitura por segundo.', 'The DHT11 only allows one reading per second.'),
      t('Umidade relativa é o quanto de vapor o ar tem perto do máximo.', 'Relative humidity is how close the air is to its vapour limit.'),
    ],
    dicaRodar: t('Mude a temperatura e a umidade em Controles.', 'Change temperature and humidity under Controls.'),
    codigo: `#include <DHT.h>

DHT dht(2, DHT11);

void setup() {
  dht.begin();
  Serial.begin(9600);
}

void loop() {
  float c = dht.readTemperature();
  float u = dht.readHumidity();
  Serial.print("Temperatura: ");
  Serial.print(c);
  Serial.print(" C  Umidade: ");
  Serial.print(u);
  Serial.println(" %");
  delay(1000);
}
`,
  },
  {
    id: 'luz-noturna',
    titulo: t('Luz noturna', 'Night light'),
    nivel: 'iniciante',
    minutos: 5,
    placa: 'uno-r3',
    resumo: t('O LDR muda de resistência com a luz. Quando escurece, o LED acende sozinho.', 'The LDR changes resistance with light. When it gets dark, the LED turns on by itself.'),
    ligacoes: [
      l('ldr', 'OUT', 'A0', 'A0 lê o divisor de tensão do LDR.', 'A0 reads the LDR voltage divider.'),
      l('ldr', 'VCC', '5V', 'Alimenta o divisor.', 'Powers the divider.'),
      l('ldr', 'GND', 'GND', 'Terra do divisor.', 'Divider ground.'),
      l('led', 'SIG', 'D13', 'O LED que acende no escuro.', 'The LED that lights in the dark.'),
      GND_LED,
    ],
    aprende: [
      t('Um divisor de tensão transforma resistência em tensão.', 'A voltage divider turns resistance into voltage.'),
      t('Um limiar (threshold) separa "claro" de "escuro".', 'A threshold separates "light" from "dark".'),
    ],
    dicaRodar: t('Baixe a luz em Controles até o LED acender.', 'Lower the light under Controls until the LED turns on.'),
    codigo: `const int LDR = A0;
const int LED_PIN = 13;
const int LIMIAR = 300;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int luz = analogRead(LDR);
  digitalWrite(LED_PIN, luz < LIMIAR ? HIGH : LOW);
  Serial.print("Luz: ");
  Serial.println(luz);
  delay(200);
}
`,
  },
  {
    id: 'arco-iris',
    titulo: t('Arco-íris no LED RGB', 'RGB rainbow'),
    nivel: 'intermediario',
    minutos: 6,
    placa: 'uno-r3',
    resumo: t('Três canais de PWM misturam vermelho, verde e azul para passear por todas as cores.', 'Three PWM channels mix red, green and blue to sweep every colour.'),
    ligacoes: [
      l('rgb', 'R', 'D9', 'Canal vermelho, com PWM.', 'Red channel, with PWM.'),
      l('rgb', 'G', 'D10', 'Canal verde, com PWM.', 'Green channel, with PWM.'),
      l('rgb', 'B', 'D11', 'Canal azul, com PWM.', 'Blue channel, with PWM.'),
      l('rgb', 'GND', 'GND', 'Catodo comum.', 'Common cathode.'),
    ],
    aprende: [
      t('Luz soma cores: vermelho + verde = amarelo.', 'Light adds colours: red + green = yellow.'),
      t('Cada canal recebe de 0 a 255 com analogWrite().', 'Each channel gets 0 to 255 with analogWrite().'),
    ],
    dicaRodar: t('Veja a lente passar pelas cores do arco-íris.', 'Watch the lens sweep through the rainbow.'),
    codigo: `const int R = 9, G = 10, B = 11;

void cor(int r, int g, int b) {
  analogWrite(R, r);
  analogWrite(G, g);
  analogWrite(B, b);
}

void setup() {
  Serial.begin(9600);
}

void loop() {
  for (int i = 0; i < 256; i++) { cor(255 - i, i, 0); delay(8); }
  for (int i = 0; i < 256; i++) { cor(0, 255 - i, i); delay(8); }
  for (int i = 0; i < 256; i++) { cor(i, 0, 255 - i); delay(8); }
  Serial.println("volta completa");
}
`,
  },
  {
    id: 'ola-oled',
    titulo: t('Olá na tela OLED', 'Hello, OLED'),
    nivel: 'intermediario',
    minutos: 7,
    placa: 'uno-r3',
    resumo: t('Pelo barramento I²C, dois fios bastam para desenhar texto numa tela de 128 × 64 pixels.', 'Over the I²C bus, two wires are enough to draw text on a 128 × 64 pixel screen.'),
    ligacoes: [
      l('oled', 'SDA', 'A4', 'No Uno, A4 é o SDA (dados) do I²C.', 'On the Uno, A4 is the I²C SDA (data).'),
      l('oled', 'SCL', 'A5', 'A5 é o SCL (relógio) do I²C.', 'A5 is the I²C SCL (clock).'),
      l('oled', 'VCC', '5V', 'A tela aceita 3,3 V ou 5 V.', 'The screen takes 3.3 V or 5 V.'),
      l('oled', 'GND', 'GND', 'Terra comum.', 'Common ground.'),
    ],
    aprende: [
      t('I²C usa endereço: a tela responde no 0x3C.', 'I²C uses addresses: the screen answers at 0x3C.'),
      t('A imagem é montada na memória e enviada com display().', 'The image is built in memory and sent with display().'),
    ],
    dicaRodar: t('A tela mostra uma saudação e um contador de segundos.', 'The screen shows a greeting and a seconds counter.'),
    codigo: `#include <Wire.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 tela(128, 64, &Wire);

void setup() {
  tela.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  Serial.begin(9600);
}

void loop() {
  tela.clearDisplay();
  tela.setTextColor(SSD1306_WHITE);
  tela.setCursor(0, 0);
  tela.println("Rumo");
  tela.println("Ola, OLED!");
  tela.print("t = ");
  tela.print(millis() / 1000);
  tela.println(" s");
  tela.display();
  Serial.println("tela atualizada");
  delay(1000);
}
`,
  },
];

export const missaoPorId = (id: string | null | undefined): Missao | undefined => (id ? MISSOES.find((m) => m.id === id) : undefined);
