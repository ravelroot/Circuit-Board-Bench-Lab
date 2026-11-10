import { fio, t } from '../base';
import type { Comando, Laboratorio } from '../tipos';

const gravarUno = (pasta: string): Comando[] => [
  { rotulo: t('Instalar o núcleo AVR (uma vez)', 'Install the AVR core (once)'), linha: 'arduino-cli core install arduino:avr' },
  { rotulo: t('Compilar', 'Compile'), linha: `arduino-cli compile --fqbn arduino:avr:uno ${pasta}` },
  { rotulo: t('Gravar (troque COM3 pela sua porta)', 'Upload (swap COM3 for your port)'), linha: `arduino-cli upload -p COM3 --fqbn arduino:avr:uno ${pasta}` },
  { rotulo: t('Monitor serial', 'Serial monitor'), linha: 'arduino-cli monitor -p COM3 -c baudrate=9600' },
];

const gravarPico = (arquivo: string): Comando[] => [
  { rotulo: t('Instalar o mpremote', 'Install mpremote'), linha: 'pip install mpremote' },
  { rotulo: t('Copiar como main.py', 'Copy as main.py'), linha: `mpremote cp ${arquivo} :main.py` },
  { rotulo: t('Reiniciar e ver a saída', 'Reset and watch the output'), linha: 'mpremote reset && mpremote repl' },
];

export const LABS_OUTROS: readonly Laboratorio[] = [
  {
    id: 'uno-blink',
    placa: 'uno-r3',
    tema: 'inicio',
    numero: 1,
    icone: 'led',
    titulo: t('Pisca o L', 'Blink the L'),
    resumo: t('O primeiro programa de todo Arduino.', 'Every Arduino’s first program.'),
    pecas: [],
    partes: ['leds', 'mcu', 'usb'],
    como: [
      t('O LED L está ligado ao pino 13 por um amplificador. digitalWrite(13, HIGH) põe 5 V no pino e o LED acende; LOW põe 0 V.', 'The L LED hangs off pin 13 through a buffer. digitalWrite(13, HIGH) puts 5 V on the pin and the LED lights; LOW puts 0 V.'),
      t('delay() para o processador pelo tempo pedido. É simples, mas trava tudo; nos labs seguintes usamos millis() para fazer várias coisas ao mesmo tempo.', 'delay() halts the processor for the time asked. It is simple but blocks everything; later labs use millis() to do several things at once.'),
    ],
    fiacao: null,
    comandos: gravarUno('uno-blink'),
    passos: [
      t('Ligue o Uno no USB.', 'Plug the Uno into USB.'),
      t('Grave o sketch uno-blink.', 'Upload the uno-blink sketch.'),
      t('Mude o tempo com fast e slow.', 'Change the timing with fast and slow.'),
    ],
    previa: {
      tipo: 'serial',
      titulo: 'Monitor serial · 9600 baud',
      inicio: ['Rumo · Uno 01 · pisca no pino 13', 'comandos: fast, slow, on, off'],
      led: { cor: '#ffcf3a', modo: 'pisca' },
      comandos: [
        { nome: 'fast', resposta: ['intervalo -> 100 ms'], led: { cor: '#ffcf3a', modo: 'pisca' } },
        { nome: 'slow', resposta: ['intervalo -> 1000 ms'], led: { cor: '#ffcf3a', modo: 'respira' } },
        { nome: 'on', resposta: ['LED fixo'], led: { cor: '#ffcf3a', modo: 'aceso' } },
        { nome: 'off', resposta: ['LED apagado'], led: { cor: '#ffcf3a', modo: 'apagado' } },
      ],
    },
    explicacaoPrevia: t('O círculo amarelo é o LED L da placa.', 'The yellow circle is the board’s L LED.'),
    codigo: {
      arquivo: 'uno-blink/uno-blink.ino',
      texto: `unsigned long intervalo = 500, antes = 0;
bool aceso = false;

void setup() {
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println("Rumo · Uno 01 · pisca no pino 13");
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c == "fast") intervalo = 100;
    else if (c == "slow") intervalo = 1000;
  }
  if (millis() - antes >= intervalo) {
    antes = millis();
    aceso = !aceso;
    digitalWrite(LED_BUILTIN, aceso);
  }
}`,
    },
  },
  {
    id: 'uno-fade',
    placa: 'uno-r3',
    tema: 'pwm',
    numero: 2,
    icone: 'onda',
    titulo: t('Brilho com PWM', 'PWM brightness'),
    resumo: t('Meia tensão sem meia tensão: o truque do PWM.', 'Half voltage without half voltage: the PWM trick.'),
    pecas: ['led-resistor', 'protoboard'],
    partes: ['digitais'],
    como: [
      t('O Uno não gera tensões intermediárias. analogWrite(9, 128) liga e desliga o pino 490 vezes por segundo, aceso metade do tempo; o olho faz a média e vê meio brilho.', 'The Uno cannot output in-between voltages. analogWrite(9, 128) switches the pin 490 times a second, on half the time; your eye averages it to half brightness.'),
      t('O resistor de 220 Ω limita a corrente a uns 14 mA. Sem ele, o LED e o pino sofrem.', 'The 220 Ω resistor limits current to about 14 mA. Without it, both LED and pin suffer.'),
    ],
    fiacao: {
      modulo: 'LED + 220 Ω',
      ligacoes: [
        fio('Ânodo (perna longa)', 'D9 ~', 'amarelo', t('Saída PWM, via resistor', 'PWM output, through the resistor')),
        fio('Cátodo (perna curta)', 'GND', 'preto', t('Terra', 'Ground')),
      ],
    },
    comandos: gravarUno('uno-fade'),
    passos: [
      t('Monte LED e resistor na protoboard.', 'Place the LED and resistor on the breadboard.'),
      t('Ligue no D9 e no GND.', 'Wire to D9 and GND.'),
      t('Grave e veja o brilho subir e descer.', 'Upload and watch the brightness rise and fall.'),
    ],
    previa: { tipo: 'pwm', tensao: 5, frequencia: 490 },
    explicacaoPrevia: t('Arraste o ciclo de trabalho e veja a onda, a tensão média e o brilho.', 'Drag the duty cycle and see the wave, the average voltage and the brightness.'),
    codigo: {
      arquivo: 'uno-fade/uno-fade.ino',
      texto: `void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  for (int v = 0; v <= 255; v++) { analogWrite(9, v); delay(4); }
  for (int v = 255; v >= 0; v--) { analogWrite(9, v); delay(4); }
}`,
    },
  },
  {
    id: 'uno-servo',
    placa: 'uno-r3',
    tema: 'pwm',
    numero: 3,
    icone: 'servo',
    titulo: t('Servo com potenciômetro', 'Servo with a pot'),
    resumo: t('Gire o botão e o braço segue.', 'Turn the knob and the arm follows.'),
    pecas: ['servo-sg90', 'potenciometro', 'protoboard'],
    partes: ['digitais', 'analogicos', 'alimentacao'],
    como: [
      t('O servo recebe um pulso a cada 20 ms. A largura do pulso diz o ângulo: perto de 0,5 ms é 0°, 1,5 ms é 90° e 2,4 ms é 180°. Um circuito interno compara com um potenciômetro no eixo e corrige.', 'A servo gets a pulse every 20 ms. Pulse width sets the angle: about 0.5 ms is 0°, 1.5 ms is 90° and 2.4 ms is 180°. An internal circuit compares with a pot on the shaft and corrects.'),
      t('O potenciômetro externo vira uma tensão de 0 a 5 V no A0; map() transforma 0–1023 em 0–180°.', 'The external pot becomes 0 to 5 V on A0; map() turns 0–1023 into 0–180°.'),
    ],
    fiacao: {
      modulo: 'SG90 + potenciômetro',
      ligacoes: [
        fio('Servo marrom', 'GND', 'marrom', t('Terra', 'Ground')),
        fio('Servo vermelho', '5V', 'vermelho', t('Alimentação', 'Power')),
        fio('Servo laranja', 'D9 ~', 'laranja', t('Sinal de controle', 'Control signal')),
        fio('Pot ponta 1', '5V', 'vermelho', t('Topo do divisor', 'Divider top')),
        fio('Pot meio', 'A0', 'amarelo', t('Tensão do cursor', 'Wiper voltage')),
        fio('Pot ponta 2', 'GND', 'preto', t('Base do divisor', 'Divider bottom')),
      ],
    },
    comandos: [{ rotulo: t('Instalar a biblioteca', 'Install the library'), linha: 'arduino-cli lib install Servo' }, ...gravarUno('uno-servo')],
    passos: [
      t('Ligue o servo e o potenciômetro.', 'Wire the servo and the pot.'),
      t('Grave o sketch.', 'Upload the sketch.'),
      t('Gire o potenciômetro devagar.', 'Turn the pot slowly.'),
    ],
    previa: { tipo: 'servo' },
    explicacaoPrevia: t('Gire o botão e veja o pulso de controle mudar de largura.', 'Turn the knob and watch the control pulse change width.'),
    codigo: {
      arquivo: 'uno-servo/uno-servo.ino',
      texto: `#include <Servo.h>

Servo braco;

void setup() {
  braco.attach(9);
}

void loop() {
  int leitura = analogRead(A0);
  braco.write(map(leitura, 0, 1023, 0, 180));
  delay(15);
}`,
    },
  },
  {
    id: 'uno-lcd',
    placa: 'uno-r3',
    tema: 'tela',
    numero: 4,
    icone: 'tela',
    titulo: t('LCD 16×2 por I²C', '16×2 LCD over I²C'),
    resumo: t('Duas linhas de texto com só dois fios de dados.', 'Two lines of text with just two data wires.'),
    pecas: ['lcd-i2c'],
    partes: ['analogicos', 'alimentacao'],
    como: [
      t('O LCD tem um controlador HD44780 que pede 6 a 10 fios. A plaquinha PCF8574 atrás converte isso para I²C: só SDA e SCL, no endereço 0x27.', 'The LCD has an HD44780 controller that needs 6 to 10 wires. The PCF8574 backpack turns that into I²C: just SDA and SCL, at address 0x27.'),
      t('O trimpot azul da plaquinha ajusta o contraste. Se a tela acender e não mostrar nada, gire ele.', 'The backpack’s blue trimpot sets contrast. If the screen lights but shows nothing, turn it.'),
    ],
    fiacao: {
      modulo: 'LCD 16×2 + PCF8574',
      ligacoes: [
        fio('GND', 'GND', 'preto', t('Terra', 'Ground')),
        fio('VCC', '5V', 'vermelho', t('O LCD é de 5 V', 'The LCD is 5 V')),
        fio('SDA', 'A4', 'verde', t('Dados I²C', 'I²C data')),
        fio('SCL', 'A5', 'amarelo', t('Relógio I²C', 'I²C clock')),
      ],
    },
    comandos: [{ rotulo: t('Instalar a biblioteca', 'Install the library'), linha: 'arduino-cli lib install "LiquidCrystal I2C"' }, ...gravarUno('uno-lcd')],
    passos: [
      t('Ligue os quatro fios.', 'Wire the four leads.'),
      t('Grave o sketch.', 'Upload the sketch.'),
      t('Ajuste o contraste no trimpot.', 'Set the contrast on the trimpot.'),
    ],
    previa: { tipo: 'tela', modelo: 'lcd1602', telas: [['Rumo · Uno 04', 'LCD 16x2 I2C'], ['Uptime', '00:01:42'], ['Endereco', '0x27  PCF8574']] },
    explicacaoPrevia: t('Clique para avançar as telas como o sketch faz a cada 3 segundos.', 'Click to advance screens like the sketch does every 3 seconds.'),
    codigo: {
      arquivo: 'uno-lcd/uno-lcd.ino',
      texto: `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.print("Rumo · Uno 04");
  lcd.setCursor(0, 1);
  lcd.print("LCD 16x2 I2C");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("uptime ");
  lcd.print(millis() / 1000);
  lcd.print(" s   ");
  delay(1000);
}`,
    },
  },
  {
    id: 'uno-ultrassom',
    placa: 'uno-r3',
    tema: 'sensores',
    numero: 5,
    icone: 'regua',
    titulo: t('Distância por ultrassom', 'Ultrasonic distance'),
    resumo: t('Um pulso, um eco e a velocidade do som.', 'A ping, an echo and the speed of sound.'),
    pecas: ['hcsr04', 'protoboard'],
    partes: ['digitais', 'alimentacao'],
    como: [
      t('Um pulso de 10 µs no TRIG faz o sensor soltar oito ciclos de 40 kHz. O pino ECHO fica alto até o eco voltar.', 'A 10 µs pulse on TRIG makes the sensor fire eight 40 kHz cycles. ECHO stays high until the echo returns.'),
      t('O som anda 343 m/s, ou 0,0343 cm/µs, e faz ida e volta. Por isso distância = tempo × 0,0343 / 2, que é o mesmo que tempo / 58.', 'Sound travels 343 m/s, or 0.0343 cm/µs, there and back. So distance = time × 0.0343 / 2, the same as time / 58.'),
    ],
    fiacao: {
      modulo: 'HC-SR04',
      ligacoes: [
        fio('VCC', '5V', 'vermelho', t('Alimentação', 'Power')),
        fio('TRIG', 'D7', 'amarelo', t('Pulso de disparo', 'Trigger pulse')),
        fio('ECHO', 'D6', 'verde', t('Duração do eco', 'Echo duration')),
        fio('GND', 'GND', 'preto', t('Terra', 'Ground')),
      ],
    },
    comandos: gravarUno('uno-ultrassom'),
    passos: [
      t('Ligue o sensor.', 'Wire the sensor.'),
      t('Grave e abra o monitor.', 'Upload and open the monitor.'),
      t('Aponte para uma parede e meça com uma trena para conferir.', 'Aim at a wall and check with a tape measure.'),
    ],
    previa: { tipo: 'distancia' },
    explicacaoPrevia: t('Mova o objeto e veja o tempo do eco e a distância calculada.', 'Move the object and see the echo time and computed distance.'),
    codigo: {
      arquivo: 'uno-ultrassom/uno-ultrassom.ino',
      texto: `const int TRIG = 7, ECHO = 6;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 30000);
  Serial.print(us / 58.0);
  Serial.println(" cm");
  delay(200);
}`,
    },
  },
  {
    id: 'pico-blink',
    placa: 'pico',
    tema: 'inicio',
    numero: 1,
    icone: 'led',
    titulo: t('MicroPython e LED', 'MicroPython and LED'),
    resumo: t('Grave o MicroPython e pisque o LED do GP25.', 'Flash MicroPython and blink the GP25 LED.'),
    pecas: [],
    partes: ['bootsel', 'usb', 'led', 'flash'],
    como: [
      t('Segure o BOOTSEL e ligue o cabo: o Pico aparece como o drive RPI-RP2. Arraste o .uf2 do MicroPython e ele reinicia rodando o interpretador.', 'Hold BOOTSEL and plug in: the Pico shows up as the RPI-RP2 drive. Drop the MicroPython .uf2 and it restarts running the interpreter.'),
      t('O arquivo main.py roda sozinho a cada partida. Pin("LED") é o LED da placa, e Timer chama uma função periodicamente sem travar o REPL.', 'main.py runs by itself at every boot. Pin("LED") is the board LED, and Timer calls a function periodically without blocking the REPL.'),
    ],
    fiacao: null,
    comandos: gravarPico('pisca.py'),
    passos: [
      t('Grave o MicroPython com BOOTSEL.', 'Flash MicroPython with BOOTSEL.'),
      t('Copie o pisca.py como main.py.', 'Copy pisca.py as main.py.'),
      t('Reinicie e veja o LED.', 'Reset and watch the LED.'),
    ],
    previa: {
      tipo: 'serial',
      titulo: 'REPL · MicroPython v1.24',
      inicio: ['MicroPython v1.24.0 on 2024-10-25; Raspberry Pi Pico with RP2040', 'Rumo · Pico 01 · LED no GP25'],
      led: { cor: '#44ff66', modo: 'pisca' },
      comandos: [
        { nome: 'led.on()', resposta: ['>>> led.on()'], led: { cor: '#44ff66', modo: 'aceso' } },
        { nome: 'led.off()', resposta: ['>>> led.off()'], led: { cor: '#44ff66', modo: 'apagado' } },
        { nome: 'tim.init(freq=4)', resposta: ['>>> tim.init(freq=4, callback=alternar)'], led: { cor: '#44ff66', modo: 'pisca' } },
        { nome: 'machine.freq()', resposta: ['>>> machine.freq()', '125000000'] },
      ],
    },
    explicacaoPrevia: t('Um REPL simulado: os comandos são Python de verdade.', 'A simulated REPL: the commands are real Python.'),
    codigo: {
      arquivo: 'pisca.py',
      texto: `from machine import Pin, Timer

led = Pin("LED", Pin.OUT)
tim = Timer()

def alternar(_):
    led.toggle()

tim.init(freq=2, mode=Timer.PERIODIC, callback=alternar)
print("Rumo · Pico 01 · LED no GP25")`,
    },
  },
  {
    id: 'pico-temperatura',
    placa: 'pico',
    tema: 'sensores',
    numero: 2,
    icone: 'termometro',
    titulo: t('Termômetro interno', 'Internal thermometer'),
    resumo: t('Ler o sensor de temperatura dentro do RP2040.', 'Read the temperature sensor inside the RP2040.'),
    pecas: [],
    partes: ['rp2040'],
    como: [
      t('O RP2040 tem um diodo sensor ligado ao canal 4 do ADC. A tensão cai cerca de 1,721 mV por grau e vale 0,706 V a 27 °C.', 'The RP2040 has a sensor diode on ADC channel 4. Its voltage drops about 1.721 mV per degree and reads 0.706 V at 27 °C.'),
      t('O ADC devolve 0 a 65535 para 0 a 3,3 V. A fórmula 27 − (V − 0,706) / 0,001721 dá a temperatura do chip, um pouco acima da ambiente.', 'The ADC returns 0 to 65535 for 0 to 3.3 V. The formula 27 − (V − 0.706) / 0.001721 gives the chip temperature, a bit above ambient.'),
    ],
    fiacao: null,
    comandos: gravarPico('temperatura.py'),
    passos: [
      t('Copie o temperatura.py.', 'Copy temperatura.py.'),
      t('Veja as leituras no REPL.', 'Watch the readings in the REPL.'),
      t('Segure o chip entre os dedos e veja subir.', 'Hold the chip between your fingers and watch it rise.'),
    ],
    previa: {
      tipo: 'serial',
      titulo: 'REPL · MicroPython v1.24',
      inicio: ['Rumo · Pico 02 · ADC4 = sensor interno'],
      periodico: { ms: 1500, linhas: ['adc=14112  V=0.7106  T=24.3 °C', 'adc=14105  V=0.7102  T=24.6 °C', 'adc=14080  V=0.7090  T=25.3 °C', 'adc=14048  V=0.7074  T=26.2 °C', 'adc=14016  V=0.7058  T=27.1 °C', 'adc=14064  V=0.7082  T=25.7 °C'] },
      comandos: [{ nome: 'machine.reset()', resposta: ['>>> machine.reset()', 'Rumo · Pico 02 · ADC4 = sensor interno'] }],
    },
    explicacaoPrevia: t('Leituras de exemplo chegando a cada segundo e meio, como no REPL.', 'Example readings arriving every second and a half, as in the REPL.'),
    codigo: {
      arquivo: 'temperatura.py',
      texto: `from machine import ADC
import time

sensor = ADC(4)
FATOR = 3.3 / 65535

while True:
    bruto = sensor.read_u16()
    volts = bruto * FATOR
    graus = 27 - (volts - 0.706) / 0.001721
    print(f"adc={bruto}  V={volts:.4f}  T={graus:.1f} °C")
    time.sleep(1.5)`,
    },
  },
  {
    id: 'pi-sistema',
    placa: 'pi5',
    tema: 'sistema',
    numero: 1,
    icone: 'disco',
    titulo: t('Gravar o sistema', 'Flash the system'),
    resumo: t('Raspberry Pi OS no microSD com SSH já ligado.', 'Raspberry Pi OS on microSD with SSH ready.'),
    pecas: ['microsd', 'fonte-27w', 'pc-imager'],
    partes: ['sd', 'energia', 'soc'],
    como: [
      t('O Raspberry Pi Imager baixa o sistema e grava no cartão. Na engrenagem de personalização você define usuário, Wi-Fi, nome da máquina e liga o SSH, sem precisar de monitor.', 'Raspberry Pi Imager downloads the system and writes it to the card. In the customisation gear you set user, Wi-Fi, hostname and enable SSH, no monitor needed.'),
      t('O Pi 5 dá partida pela EEPROM, que procura o cartão, o USB e o NVMe na ordem configurada. A fonte de 27 W evita o aviso de subtensão e libera 1,6 A nas portas USB.', 'The Pi 5 boots from its EEPROM, which looks for SD, USB and NVMe in the configured order. The 27 W supply avoids the undervoltage warning and allows 1.6 A on the USB ports.'),
    ],
    fiacao: null,
    comandos: [
      { rotulo: t('Entrar pela rede', 'Log in over the network'), linha: 'ssh rumo@rumo.local' },
      { rotulo: t('Atualizar o sistema', 'Update the system'), linha: 'sudo apt update && sudo apt full-upgrade -y' },
      { rotulo: t('Ver a temperatura', 'Check the temperature'), linha: 'vcgencmd measure_temp' },
      { rotulo: t('Conferir subtensão', 'Check undervoltage'), linha: 'vcgencmd get_throttled' },
    ],
    passos: [
      t('Grave o Raspberry Pi OS com o Imager.', 'Write Raspberry Pi OS with Imager.'),
      t('Defina usuário, Wi-Fi e SSH na personalização.', 'Set user, Wi-Fi and SSH in customisation.'),
      t('Coloque o cartão e ligue a fonte.', 'Insert the card and plug in the supply.'),
      t('Entre por SSH e atualize.', 'SSH in and update.'),
    ],
    previa: {
      tipo: 'serial',
      titulo: 'SSH · rumo@rumo.local',
      inicio: ['Linux rumo 6.6.51+rpt-rpi-2712 #1 SMP PREEMPT aarch64', 'rumo@rumo:~ $'],
      comandos: [
        { nome: 'uname -m', resposta: ['aarch64'] },
        { nome: 'vcgencmd measure_temp', resposta: ["temp=48.2'C"] },
        { nome: 'vcgencmd get_throttled', resposta: ['throttled=0x0', '0x0 = sem subtensão e sem limitação térmica'] },
        { nome: 'free -h', resposta: ['       total   used   free', 'Mem:   7.9Gi  612Mi  6.9Gi'] },
        { nome: 'lsblk', resposta: ['NAME        SIZE TYPE MOUNTPOINT', 'mmcblk0    29.7G disk', '├─mmcblk0p1  512M part /boot/firmware', '└─mmcblk0p2 29.2G part /'] },
      ],
    },
    explicacaoPrevia: t('Um terminal SSH simulado com as respostas de um Pi 5 de 8 GB recém-instalado.', 'A simulated SSH terminal with replies from a freshly set up 8 GB Pi 5.'),
    codigo: null,
  },
  {
    id: 'pi-gpio',
    placa: 'pi5',
    tema: 'gpio',
    numero: 2,
    icone: 'led',
    titulo: t('LED e botão com gpiozero', 'LED and button with gpiozero'),
    resumo: t('Python acendendo um LED quando o botão é apertado.', 'Python lighting an LED when the button is pressed.'),
    pecas: ['led-resistor', 'botao', 'protoboard', 'microsd', 'fonte-27w'],
    partes: ['gpio', 'rp1'],
    como: [
      t('No Pi 5 os GPIO moram no chip RP1. A biblioteca gpiozero esconde esse detalhe: LED(17) e Button(27) usam os números BCM, não os números físicos dos pinos.', 'On the Pi 5 the GPIOs live in the RP1 chip. The gpiozero library hides that: LED(17) and Button(27) use BCM numbers, not physical pin numbers.'),
      t('Button já liga o pull-up interno, então o botão vai do GPIO ao GND. Os GPIO são de 3,3 V: nunca ligue 5 V neles.', 'Button enables the internal pull-up, so the button goes from GPIO to GND. GPIOs are 3.3 V: never feed them 5 V.'),
    ],
    fiacao: {
      modulo: 'LED + botão',
      ligacoes: [
        fio('LED ânodo (via 220 Ω)', 'GPIO17 · pino 11', 'amarelo', t('Saída do LED', 'LED output')),
        fio('LED cátodo', 'GND · pino 9', 'preto', t('Terra', 'Ground')),
        fio('Botão perna 1', 'GPIO27 · pino 13', 'verde', t('Entrada com pull-up', 'Input with pull-up')),
        fio('Botão perna 2', 'GND · pino 14', 'preto', t('Terra', 'Ground')),
      ],
    },
    comandos: [
      { rotulo: t('Rodar o programa', 'Run the program'), linha: 'python3 led_botao.py' },
      { rotulo: t('Ver o mapa dos pinos', 'Show the pin map'), linha: 'pinout' },
    ],
    passos: [
      t('Desligue o Pi antes de mexer nos fios.', 'Power the Pi off before wiring.'),
      t('Monte LED, resistor e botão.', 'Place the LED, resistor and button.'),
      t('Rode o programa e aperte o botão.', 'Run the program and press the button.'),
    ],
    previa: {
      tipo: 'serial',
      titulo: 'Terminal · python3 led_botao.py',
      inicio: ['Rumo · Pi 02 · LED no GPIO17, botão no GPIO27', 'aperte o botão (Ctrl+C para sair)'],
      led: { cor: '#ffcf3a', modo: 'apagado' },
      comandos: [
        { nome: 'apertar', resposta: ['botão apertado -> LED aceso'], led: { cor: '#ffcf3a', modo: 'aceso' } },
        { nome: 'soltar', resposta: ['botão solto -> LED apagado'], led: { cor: '#ffcf3a', modo: 'apagado' } },
        { nome: 'segurar 2 s', resposta: ['botão segurado 2 s -> pisca'], led: { cor: '#ffcf3a', modo: 'pisca' } },
      ],
    },
    explicacaoPrevia: t('Simule o botão e veja o LED responder como no Python.', 'Simulate the button and see the LED respond like the Python does.'),
    codigo: {
      arquivo: 'led_botao.py',
      texto: `from gpiozero import LED, Button
from signal import pause

led = LED(17)
botao = Button(27, hold_time=2)

botao.when_pressed = led.on
botao.when_released = led.off
botao.when_held = lambda: led.blink(0.2, 0.2)

print("Rumo · Pi 02 · LED no GPIO17, botão no GPIO27")
pause()`,
    },
  },
  {
    id: 'pi-pinagem',
    placa: 'pi5',
    tema: 'gpio',
    numero: 3,
    icone: 'pino',
    titulo: t('Mapa dos 40 pinos', 'The 40-pin map'),
    resumo: t('Qual pino é energia, terra, I²C, SPI, UART e PWM.', 'Which pin is power, ground, I²C, SPI, UART and PWM.'),
    pecas: ['microsd', 'fonte-27w'],
    partes: ['gpio'],
    como: [
      t('O conector tem numeração física (1 a 40, ímpares de um lado) e numeração BCM, usada no código. O pino 1 é o de ilha quadrada, perto do canto.', 'The header has physical numbers (1 to 40, odd on one side) and BCM numbers, used in code. Pin 1 has the square pad, near the corner.'),
      t('Vários pinos têm funções alternativas: I²C no 3 e 5, SPI no 19, 21 e 23, UART no 8 e 10 e PWM de hardware no 12 e 35.', 'Many pins have alternate functions: I²C on 3 and 5, SPI on 19, 21 and 23, UART on 8 and 10 and hardware PWM on 12 and 35.'),
    ],
    fiacao: null,
    comandos: [{ rotulo: t('Mapa no terminal', 'Map in the terminal'), linha: 'pinout' }, { rotulo: t('Ver o estado dos pinos', 'Inspect pin state'), linha: 'pinctrl get 2-27' }],
    passos: [t('Rode pinout no Pi.', 'Run pinout on the Pi.'), t('Ache os pinos de I²C e de 3,3 V.', 'Find the I²C and 3.3 V pins.'), t('Confira com o mapa interativo.', 'Check against the interactive map.')],
    previa: { tipo: 'pinagem' },
    explicacaoPrevia: t('Filtre por função e clique num pino para ver o número BCM e as funções.', 'Filter by function and click a pin to see its BCM number and functions.'),
    codigo: null,
  },
  {
    id: 'atx-cpu',
    placa: 'atx',
    tema: 'montagem',
    numero: 1,
    icone: 'chip',
    titulo: t('Processador e cooler', 'CPU and cooler'),
    resumo: t('Encaixe sem força, pasta na medida e cooler ligado.', 'Seat without force, the right amount of paste and the cooler plugged in.'),
    pecas: ['cpu-am5', 'chave-fenda'],
    partes: ['cpu', 'vrm', 'fans', 'eps'],
    como: [
      t('No AM5 os contatos ficam no soquete. O triângulo dourado do processador alinha com o triângulo da moldura; ele deve cair no lugar pelo próprio peso.', 'On AM5 the contacts are in the socket. The CPU’s gold triangle lines up with the frame’s triangle; it should drop in by its own weight.'),
      t('A pasta térmica preenche microfendas entre o processador e o cooler: um grão de ervilha no centro basta. O cooler vai no CPU_FAN, e o cabo EPS de 8 pinos é obrigatório.', 'Thermal paste fills micro gaps between CPU and cooler: a pea-sized dot in the centre is enough. The cooler goes on CPU_FAN, and the 8-pin EPS cable is mandatory.'),
    ],
    fiacao: null,
    comandos: [],
    passos: [
      t('Descarregue a estática tocando em metal aterrado.', 'Discharge static by touching grounded metal.'),
      t('Abra a alavanca e alinhe os triângulos.', 'Open the lever and line up the triangles.'),
      t('Feche a alavanca: a tampa plástica sai sozinha.', 'Close the lever: the plastic cap pops off.'),
      t('Aplique a pasta e aperte o cooler em X.', 'Apply paste and tighten the cooler in an X pattern.'),
      t('Ligue o cooler no CPU_FAN e o cabo EPS.', 'Plug the cooler into CPU_FAN and connect EPS.'),
    ],
    previa: { tipo: 'post', cenario: 'cpu' },
    explicacaoPrevia: t('Esta prévia começa com o EPS desconectado: o LED CPU trava. Troque o cenário para ver os outros erros.', 'This preview starts with EPS unplugged: the CPU LED sticks. Switch the scenario to see other faults.'),
    codigo: null,
  },
  {
    id: 'atx-memoria',
    placa: 'atx',
    tema: 'montagem',
    numero: 2,
    icone: 'memoria',
    titulo: t('Memória em dual channel', 'Memory in dual channel'),
    resumo: t('Em quais slots pôr dois pentes, e por quê.', 'Which slots to use for two sticks, and why.'),
    pecas: ['ram-ddr5'],
    partes: ['ram'],
    como: [
      t('O processador tem dois controladores de memória, canal A e canal B. Um pente em cada canal dobra a largura de banda.', 'The CPU has two memory controllers, channel A and channel B. One stick per channel doubles the bandwidth.'),
      t('Com dois pentes, o manual quase sempre pede A2 e B2: são os slots mais distantes do processador, onde as trilhas foram desenhadas para a melhor qualidade de sinal.', 'With two sticks the manual almost always asks for A2 and B2: the slots farthest from the CPU, where traces are tuned for the best signal.'),
    ],
    fiacao: null,
    comandos: [{ rotulo: t('Conferir no Windows', 'Check on Windows'), linha: 'wmic memorychip get BankLabel,DeviceLocator,Capacity,Speed' }, { rotulo: t('Conferir no Linux', 'Check on Linux'), linha: 'sudo dmidecode -t memory | grep -E "Locator|Size|Speed"' }],
    passos: [
      t('Abra as travas dos slots A2 e B2.', 'Open the A2 and B2 latches.'),
      t('Alinhe o entalhe e empurre até as travas clicarem.', 'Line up the notch and push until the latches click.'),
      t('Na BIOS, ative o perfil EXPO.', 'In the BIOS, enable the EXPO profile.'),
    ],
    previa: { tipo: 'memoria' },
    explicacaoPrevia: t('Clique nos slots para pôr e tirar pentes e veja o modo e a banda resultantes.', 'Click the slots to add and remove sticks and see the resulting mode and bandwidth.'),
    codigo: null,
  },
  {
    id: 'atx-bancada',
    placa: 'atx',
    tema: 'partida',
    numero: 3,
    icone: 'raio',
    titulo: t('Primeira partida na bancada', 'First boot on the bench'),
    resumo: t('Ligar fora do gabinete e ler os LEDs de diagnóstico.', 'Power on outside the case and read the debug LEDs.'),
    pecas: ['cpu-am5', 'ram-ddr5', 'fonte-atx', 'chave-fenda', 'monitor'],
    partes: ['painel', 'post', 'atx24', 'eps', 'bios'],
    como: [
      t('Montar primeiro na bancada, sobre a caixa da placa, separa defeito de peça de erro de montagem. Encostar a chave de fenda nos dois pinos PWR_SW do painel frontal faz o mesmo que o botão do gabinete.', 'Building on the bench first, on the board’s box, separates bad parts from assembly mistakes. Touching a screwdriver to the two PWR_SW pins does what the case button does.'),
      t('Durante o POST a placa testa CPU, memória, vídeo e disco nessa ordem. Um LED que fica aceso aponta onde parou. O primeiro boot com DDR5 pode levar mais de um minuto treinando a memória: espere.', 'During POST the board checks CPU, memory, video and boot drive in that order. A LED that stays lit shows where it stopped. The first DDR5 boot can take over a minute training memory: wait.'),
    ],
    fiacao: null,
    comandos: [],
    passos: [
      t('Ligue o ATX 24 e o EPS 8.', 'Connect ATX 24 and EPS 8.'),
      t('Ligue o monitor na placa de vídeo ou na saída da placa-mãe.', 'Plug the monitor into the GPU or the board output.'),
      t('Encoste a chave nos pinos PWR_SW.', 'Touch the screwdriver to the PWR_SW pins.'),
      t('Espere o treino de memória terminar.', 'Wait for memory training to finish.'),
    ],
    previa: { tipo: 'post', cenario: 'ok' },
    explicacaoPrevia: t('Ligue a placa e acompanhe os LEDs. Escolha um cenário de falha para ver onde cada um trava.', 'Power the board and follow the LEDs. Pick a fault scenario to see where each one stops.'),
    codigo: null,
  },
  {
    id: 'ne555-pisca',
    placa: 'ne555',
    tema: 'circuito',
    numero: 1,
    icone: 'onda',
    titulo: t('Ajustar o pisca', 'Tune the blinker'),
    resumo: t('R1, R2 e C escolhem a frequência e o ciclo.', 'R1, R2 and C pick the frequency and duty.'),
    pecas: ['fonte-9v', 'multimetro'],
    partes: ['ci', 'resistores', 'capacitor', 'potenciometro', 'led'],
    como: [
      t('O capacitor carrega por R1 + R2 até 2/3 de VCC; aí o 555 desliga a saída e descarrega o capacitor só por R2 até 1/3 de VCC, e o ciclo recomeça.', 'The capacitor charges through R1 + R2 to 2/3 VCC; then the 555 turns the output off and discharges through R2 alone to 1/3 VCC, and the cycle repeats.'),
      t('Tempo alto = 0,693 (R1 + R2) C, tempo baixo = 0,693 R2 C. Com 1 kΩ, 47 kΩ e 10 µF, dá cerca de 1,5 Hz.', 'High time = 0.693 (R1 + R2) C, low time = 0.693 R2 C. With 1 kΩ, 47 kΩ and 10 µF it is about 1.5 Hz.'),
    ],
    fiacao: null,
    comandos: [],
    passos: [
      t('Alimente com 9 V.', 'Power it from 9 V.'),
      t('Conte as piscadas em 10 segundos.', 'Count the blinks in 10 seconds.'),
      t('Gire o trimpot e veja mudar.', 'Turn the trimpot and watch it change.'),
      t('Meça a tensão no pino 2 com o multímetro.', 'Measure pin 2 with the multimeter.'),
    ],
    previa: { tipo: 'timer555' },
    explicacaoPrevia: t('Mude R1, R2 e C. O gráfico mostra a carga do capacitor entre 1/3 e 2/3 de VCC e a saída.', 'Change R1, R2 and C. The plot shows the capacitor charging between 1/3 and 2/3 VCC and the output.'),
    codigo: null,
  },
  {
    id: 'lm7805-fonte',
    placa: 'lm7805',
    tema: 'circuito',
    numero: 1,
    icone: 'raio',
    titulo: t('Quanto esquenta o 7805', 'How hot the 7805 gets'),
    resumo: t('Queda de tensão, corrente e calor no dissipador.', 'Voltage drop, current and heat on the heatsink.'),
    pecas: ['fonte-9v', 'multimetro'],
    partes: ['regulador', 'entrada', 'saida'],
    como: [
      t('Um regulador linear é uma resistência que se ajusta sozinha: toda a tensão que sobra vira calor. Com 12 V de entrada e 0,5 A de carga, ele queima (12 − 5) × 0,5 = 3,5 W.', 'A linear regulator is a self-adjusting resistor: all surplus voltage becomes heat. With 12 V in and a 0.5 A load it burns (12 − 5) × 0.5 = 3.5 W.'),
      t('Sem dissipador, o TO-220 sobe cerca de 65 °C por watt e passa de 125 °C, quando a proteção térmica corta. Com dissipador, a resistência térmica cai para uns 20 °C/W.', 'Without a heatsink the TO-220 rises about 65 °C per watt and passes 125 °C, when thermal protection cuts out. With a heatsink thermal resistance drops to about 20 °C/W.'),
    ],
    fiacao: null,
    comandos: [],
    passos: [
      t('Meça a saída sem carga: deve dar 4,9 a 5,1 V.', 'Measure the output with no load: it should read 4.9 to 5.1 V.'),
      t('Ponha uma carga e meça de novo.', 'Add a load and measure again.'),
      t('Calcule a potência dissipada.', 'Compute the power dissipated.'),
    ],
    previa: { tipo: 'regulador' },
    explicacaoPrevia: t('Ajuste entrada, carga e dissipador e veja a saída, o calor e a temperatura do chip.', 'Adjust input, load and heatsink and see the output, heat and chip temperature.'),
    codigo: null,
  },
  {
    id: 'l298n-motor',
    placa: 'l298n',
    tema: 'circuito',
    numero: 1,
    icone: 'motor',
    titulo: t('Sentido e velocidade', 'Direction and speed'),
    resumo: t('IN1, IN2 e PWM no ENA controlam um motor DC.', 'IN1, IN2 and PWM on ENA drive a DC motor.'),
    pecas: ['motor-dc', 'fonte-9v', 'arduino', 'protoboard'],
    partes: ['l298', 'motores', 'entradas', 'alimentacao'],
    como: [
      t('Uma ponte H tem quatro chaves em volta do motor. Fechando duas em diagonal a corrente passa num sentido; fechando as outras duas, no sentido contrário.', 'An H-bridge has four switches around the motor. Closing one diagonal pair sends current one way; closing the other pair sends it back.'),
      t('IN1 e IN2 escolhem o sentido; os dois iguais freiam. O PWM no ENA liga e desliga a ponte rápido e controla a velocidade.', 'IN1 and IN2 pick the direction; both equal means brake. PWM on ENA switches the bridge fast and controls speed.'),
    ],
    fiacao: {
      modulo: 'L298N',
      ligacoes: [
        fio('ENA (tire o jumper)', 'D9 ~', 'laranja', t('PWM da velocidade', 'Speed PWM')),
        fio('IN1', 'D7', 'amarelo', t('Sentido A', 'Direction A')),
        fio('IN2', 'D8', 'verde', t('Sentido B', 'Direction B')),
        fio('GND', 'GND', 'preto', t('Terra comum obrigatório', 'Shared ground required')),
        fio('12V', 'Fonte +', 'vermelho', t('Alimentação do motor', 'Motor supply')),
        fio('OUT1 / OUT2', 'Motor', 'branco', t('Os dois fios do motor', 'The motor’s two leads')),
      ],
    },
    comandos: [
      { rotulo: t('Compilar', 'Compile'), linha: 'arduino-cli compile --fqbn arduino:avr:uno l298n-motor' },
      { rotulo: t('Gravar', 'Upload'), linha: 'arduino-cli upload -p COM3 --fqbn arduino:avr:uno l298n-motor' },
    ],
    passos: [
      t('Ligue a fonte do motor no borne 12V e GND.', 'Connect the motor supply to the 12V and GND terminal.'),
      t('Una o GND do módulo ao GND do Arduino.', 'Tie the module GND to the Arduino GND.'),
      t('Ligue IN1, IN2 e ENA.', 'Wire IN1, IN2 and ENA.'),
      t('Grave e observe o motor acelerar, frear e inverter.', 'Upload and watch the motor speed up, brake and reverse.'),
    ],
    previa: { tipo: 'ponteh' },
    explicacaoPrevia: t('Mude IN1, IN2 e o PWM: as chaves acesas mostram por onde passa a corrente.', 'Change IN1, IN2 and PWM: the lit switches show where current flows.'),
    codigo: {
      arquivo: 'l298n-motor/l298n-motor.ino',
      texto: `const int ENA = 9, IN1 = 7, IN2 = 8;

void motor(int velocidade) {
  digitalWrite(IN1, velocidade > 0);
  digitalWrite(IN2, velocidade < 0);
  analogWrite(ENA, abs(velocidade));
}

void setup() {
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
}

void loop() {
  for (int v = 0; v <= 255; v += 5) { motor(v); delay(30); }
  motor(0);
  delay(800);
  for (int v = 0; v >= -255; v -= 5) { motor(v); delay(30); }
  motor(0);
  delay(800);
}`,
    },
  },
];
