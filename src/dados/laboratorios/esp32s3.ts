import { fio, t } from '../base';
import type { Comando, Laboratorio } from '../tipos';

const FQBN = 'esp32:esp32:esp32s3';

const gravar = (pasta: string): Comando[] => [
  { rotulo: t('Instalar o núcleo ESP32 (uma vez)', 'Install the ESP32 core (once)'), linha: 'arduino-cli core install esp32:esp32' },
  { rotulo: t('Achar a porta da placa', 'Find the board port'), linha: 'arduino-cli board list' },
  { rotulo: t('Compilar', 'Compile'), linha: `arduino-cli compile --fqbn ${FQBN} ${pasta}` },
  { rotulo: t('Gravar (troque COM3 pela sua porta)', 'Upload (swap COM3 for your port)'), linha: `arduino-cli upload -p COM3 --fqbn ${FQBN} ${pasta}` },
  { rotulo: t('Abrir o monitor serial', 'Open the serial monitor'), linha: 'arduino-cli monitor -p COM3 -c baudrate=115200' },
];

export const LABS_ESP32: readonly Laboratorio[] = [
  {
    id: 'ola',
    placa: 'esp32-s3',
    tema: 'inicio',
    numero: 1,
    icone: 'terminal',
    titulo: t('Olá, bancada', 'Hello, bench'),
    resumo: t('Ferramentas, primeiro programa e o monitor serial.', 'Tools, first program and the serial monitor.'),
    pecas: [],
    partes: ['usb', 'ponte', 'modulo'],
    como: [
      t('O ESP32-S3 sai de fábrica com um bootloader na ROM. Quando o computador grava, a ponte USB-serial segura o BOOT, pulsa o RST e o chip passa a ouvir a serial em vez de rodar o programa antigo.', 'The ESP32-S3 ships with a bootloader in ROM. When the computer uploads, the USB-serial bridge holds BOOT, pulses RST and the chip listens on serial instead of running the old program.'),
      t('Depois da gravação, o chip reinicia e executa setup() uma vez e loop() para sempre. Serial.begin(115200) abre a porta a 115 200 bits por segundo, e tudo o que você imprime aparece no monitor.', 'After the upload the chip restarts and runs setup() once and loop() forever. Serial.begin(115200) opens the port at 115,200 bits per second, and everything you print shows up in the monitor.'),
      t('Use a porta USB marcada como UART para este lab: ela mostra as mensagens de boot da ROM, ótimas para diagnosticar.', 'Use the USB port marked UART for this lab: it shows the ROM boot messages, great for diagnosing.'),
    ],
    fiacao: null,
    comandos: gravar('ola'),
    passos: [
      t('Instale o arduino-cli e o núcleo ESP32.', 'Install arduino-cli and the ESP32 core.'),
      t('Ligue o cabo na porta UART e ache a porta com board list.', 'Plug into the UART port and find it with board list.'),
      t('Compile e grave o sketch ola.', 'Compile and upload the ola sketch.'),
      t('Abra o monitor e digite info.', 'Open the monitor and type info.'),
    ],
    previa: {
      tipo: 'serial',
      inicio: ['ESP-ROM:esp32s3-20210327', 'rst:0x1 (POWERON),boot:0x8 (SPI_FAST_FLASH_BOOT)', 'Rumo 01 · olá, bancada!', 'digite help para ver os comandos'],
      comandos: [
        { nome: 'help', resposta: ['comandos: info, uptime, heap, reset'] },
        { nome: 'info', resposta: ['chip: ESP32-S3 rev 0.2', 'núcleos: 2 · 240 MHz', 'flash: 16 MB · PSRAM: 8 MB'] },
        { nome: 'uptime', resposta: ['ligado há 00:01:27'] },
        { nome: 'heap', resposta: ['heap livre: 352 KB · PSRAM livre: 8 175 KB'] },
        { nome: 'reset', resposta: ['reiniciando...', 'ESP-ROM:esp32s3-20210327', 'Rumo 01 · olá, bancada!'] },
      ],
    },
    explicacaoPrevia: t('Um monitor de mentira, mas com as mesmas respostas do sketch. Clique nos comandos ou digite.', 'A pretend monitor with the same replies as the sketch. Click the commands or type.'),
    codigo: {
      arquivo: 'ola/ola.ino',
      texto: `void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("Rumo 01 · olá, bancada!");
  Serial.println("digite help para ver os comandos");
}

void loop() {
  if (!Serial.available()) return;
  String cmd = Serial.readStringUntil('\\n');
  cmd.trim();
  if (cmd == "help") Serial.println("comandos: info, uptime, heap, reset");
  else if (cmd == "info") {
    Serial.printf("chip: %s rev %d\\n", ESP.getChipModel(), ESP.getChipRevision());
    Serial.printf("núcleos: %d · %lu MHz\\n", ESP.getChipCores(), ESP.getCpuFreqMHz());
    Serial.printf("flash: %lu MB · PSRAM: %lu MB\\n", ESP.getFlashChipSize() >> 20, ESP.getPsramSize() >> 20);
  } else if (cmd == "uptime") Serial.printf("ligado há %lu s\\n", millis() / 1000);
  else if (cmd == "heap") Serial.printf("heap livre: %lu KB\\n", ESP.getFreeHeap() >> 10);
  else if (cmd == "reset") ESP.restart();
}`,
    },
  },
  {
    id: 'led-rgb',
    placa: 'esp32-s3',
    tema: 'inicio',
    numero: 2,
    icone: 'led',
    titulo: t('LED RGB', 'RGB LED'),
    resumo: t('Cores, pisca, respiração e SOS no WS2812 da placa.', 'Colours, blink, breathe and SOS on the board’s WS2812.'),
    pecas: [],
    partes: ['led', 'modulo'],
    como: [
      t('O LED da placa é um WS2812: ele tem um chip dentro que recebe 24 bits por um único fio, 8 para cada cor. Um bit 1 é um pulso longo e um bit 0, um pulso curto.', 'The board LED is a WS2812: it has a chip inside that receives 24 bits on one wire, 8 per colour. A 1 bit is a long pulse and a 0 bit a short one.'),
      t('O núcleo ESP32 gera esse sinal com o periférico RMT pela função rgbLedWrite(pino, r, g, b). Para respirar, o programa varia o brilho em passos pequenos; para SOS, segue o código Morse: três curtos, três longos, três curtos.', 'The ESP32 core makes that signal with the RMT peripheral via rgbLedWrite(pin, r, g, b). To breathe, the program steps the brightness gently; for SOS it follows Morse: three short, three long, three short.'),
    ],
    fiacao: null,
    comandos: gravar('led-rgb'),
    passos: [
      t('Grave o sketch led-rgb.', 'Upload the led-rgb sketch.'),
      t('Digite on, off e blink 200 no monitor.', 'Type on, off and blink 200 in the monitor.'),
      t('Teste fade e sos.', 'Try fade and sos.'),
      t('Se nada acender, troque RGB_BUILTIN por 38 (placa v1.1).', 'If nothing lights, swap RGB_BUILTIN for 38 (v1.1 board).'),
    ],
    previa: {
      tipo: 'serial',
      inicio: ['Rumo 02 · LED RGB no GPIO48', 'comandos: on, off, blink 200, fade, sos, level 30, help'],
      led: { cor: '#7ad0ff', modo: 'apagado' },
      comandos: [
        { nome: 'on', resposta: ['[setMode] modo -> aceso'], led: { cor: '#7ad0ff', modo: 'aceso' } },
        { nome: 'off', resposta: ['[setMode] modo -> apagado'], led: { cor: '#7ad0ff', modo: 'apagado' } },
        { nome: 'blink 200', resposta: ['[setMode] modo -> pisca, 200 ms'], led: { cor: '#7ad0ff', modo: 'pisca' } },
        { nome: 'fade', resposta: ['[setMode] modo -> respira'], led: { cor: '#b98cff', modo: 'respira' } },
        { nome: 'sos', resposta: ['[setMode] modo -> sos (··· --- ···)'], led: { cor: '#ff4d3d', modo: 'sos' } },
        { nome: 'level 30', resposta: ['[handleCommand] nível -> 30'], led: { cor: '#2e6a85', modo: 'aceso' } },
        { nome: 'help', resposta: ['comandos: on, off, blink <ms>, fade, sos, level <0-255>'] },
      ],
    },
    explicacaoPrevia: t('O círculo é o LED da placa. Cada comando muda o modo como o sketch faria.', 'The circle is the board LED. Each command switches mode as the sketch would.'),
    codigo: {
      arquivo: 'led-rgb/led-rgb.ino',
      texto: `enum Modo { APAGADO, ACESO, PISCA, RESPIRA, SOS };
Modo modo = APAGADO;
uint8_t nivel = 64;
uint32_t intervalo = 200;
const char *MORSE = "...---...";

void cor(uint8_t v) { rgbLedWrite(RGB_BUILTIN, 0, v / 2, v); }

void setup() {
  Serial.begin(115200);
  Serial.println("Rumo 02 · LED RGB no GPIO48");
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c == "on") modo = ACESO;
    else if (c == "off") modo = APAGADO;
    else if (c.startsWith("blink")) { modo = PISCA; intervalo = max(50L, c.substring(6).toInt()); }
    else if (c == "fade") modo = RESPIRA;
    else if (c == "sos") modo = SOS;
    else if (c.startsWith("level")) { nivel = constrain(c.substring(6).toInt(), 0, 255); modo = ACESO; }
  }
  uint32_t t = millis();
  switch (modo) {
    case APAGADO: cor(0); break;
    case ACESO: cor(nivel); break;
    case PISCA: cor((t / intervalo) % 2 ? nivel : 0); break;
    case RESPIRA: cor((sin(t / 600.0) + 1) * nivel / 2); break;
    case SOS: {
      uint32_t passo = (t / 200) % 30;
      char s = passo < 18 ? MORSE[passo / 2] : ' ';
      cor(passo % 2 == 0 && s != ' ' ? nivel : 0);
      break;
    }
  }
}`,
    },
  },
  {
    id: 'botao-boot',
    placa: 'esp32-s3',
    tema: 'inicio',
    numero: 3,
    icone: 'botao',
    titulo: t('Botão BOOT', 'BOOT button'),
    resumo: t('Clique, duplo clique e clique longo com debounce.', 'Click, double click and long press with debounce.'),
    pecas: [],
    partes: ['botoes'],
    como: [
      t('Depois que o programa já está rodando, o BOOT vira um botão comum no GPIO0. Com INPUT_PULLUP, o pino fica em 1 e vai a 0 quando você aperta.', 'Once the program is running, BOOT is a plain button on GPIO0. With INPUT_PULLUP the pin sits at 1 and drops to 0 when pressed.'),
      t('Contatos mecânicos “quicam” por alguns milissegundos. O debounce ignora mudanças por 25 ms; a duração do aperto separa clique de clique longo, e o intervalo entre dois cliques define o duplo.', 'Mechanical contacts bounce for a few milliseconds. Debounce ignores changes for 25 ms; press length separates click from long press, and the gap between two clicks makes a double.'),
    ],
    fiacao: null,
    comandos: gravar('botao-boot'),
    passos: [
      t('Grave o sketch botao-boot.', 'Upload the botao-boot sketch.'),
      t('Aperte o BOOT uma vez e veja “clique”.', 'Press BOOT once and see “click”.'),
      t('Faça um duplo clique e um clique longo.', 'Do a double click and a long press.'),
    ],
    previa: {
      tipo: 'serial',
      inicio: ['Rumo 03 · botão BOOT no GPIO0 (pull-up)', 'use os botões abaixo para simular apertos'],
      comandos: [
        { nome: 'clique', resposta: ['[botao] baixo 0 ms', '[botao] solto em 142 ms -> clique'] },
        { nome: 'duplo', resposta: ['[botao] solto em 120 ms', '[botao] segundo aperto em 210 ms -> duplo clique'] },
        { nome: 'longo', resposta: ['[botao] baixo 0 ms', '[botao] 800 ms segurando -> clique longo'] },
        { nome: 'quique', resposta: ['[botao] 1-0-1-0 em 4 ms: ignorado pelo debounce de 25 ms'] },
      ],
    },
    explicacaoPrevia: t('Cada botão simula um jeito de apertar o BOOT e mostra o que o sketch imprime.', 'Each button simulates a way of pressing BOOT and shows what the sketch prints.'),
    codigo: {
      arquivo: 'botao-boot/botao-boot.ino',
      texto: `const int BOTAO = 0;
bool estavel = HIGH, ultimo = HIGH;
uint32_t mudou = 0, desceu = 0, ultimoClique = 0;
bool esperandoDuplo = false;

void setup() {
  Serial.begin(115200);
  pinMode(BOTAO, INPUT_PULLUP);
}

void loop() {
  bool leitura = digitalRead(BOTAO);
  if (leitura != ultimo) { mudou = millis(); ultimo = leitura; }
  if (millis() - mudou > 25 && leitura != estavel) {
    estavel = leitura;
    if (estavel == LOW) desceu = millis();
    else {
      uint32_t duracao = millis() - desceu;
      if (duracao > 600) Serial.println("clique longo");
      else if (esperandoDuplo && millis() - ultimoClique < 300) { Serial.println("duplo clique"); esperandoDuplo = false; }
      else { esperandoDuplo = true; ultimoClique = millis(); }
    }
  }
  if (esperandoDuplo && millis() - ultimoClique > 300) { Serial.println("clique"); esperandoDuplo = false; }
}`,
    },
  },
  {
    id: 'tela-st7789',
    placa: 'esp32-s3',
    tema: 'tela',
    numero: 4,
    icone: 'tela',
    titulo: t('Tela ST7789', 'ST7789 screen'),
    resumo: t('Uma tela colorida de 170 × 320 pelo SPI.', 'A 170 × 320 colour screen over SPI.'),
    pecas: ['tela-st7789', 'protoboard'],
    partes: ['pinos', 'modulo'],
    como: [
      t('A tela fala SPI: SCK dá o ritmo, MOSI leva os dados e CS escolhe o aparelho. DC diz se o byte é comando ou pixel, e RES reinicia a tela.', 'The screen speaks SPI: SCK sets the pace, MOSI carries data and CS selects the device. DC says whether a byte is a command or a pixel, and RES resets the screen.'),
      t('Cada pixel tem 16 bits (RGB565). Os pinos 11 e 12 são o SPI2 nativo do S3, então a biblioteca usa o hardware em vez de bater bit a bit.', 'Each pixel is 16 bits (RGB565). Pins 11 and 12 are the S3’s native SPI2, so the library uses the hardware instead of bit-banging.'),
    ],
    fiacao: {
      modulo: 'ST7789 1.9"',
      ligacoes: [
        fio('GND', 'GND', 'preto', t('Terra comum', 'Common ground')),
        fio('VCC', '3V3', 'vermelho', t('A tela é de 3,3 V', 'The screen is 3.3 V')),
        fio('SCL', 'GPIO 12', 'amarelo', t('Relógio do SPI (SCK)', 'SPI clock (SCK)')),
        fio('SDA', 'GPIO 11', 'verde', t('Dados do SPI (MOSI)', 'SPI data (MOSI)')),
        fio('RES', 'GPIO 8', 'branco', t('Reset da tela', 'Screen reset')),
        fio('DC', 'GPIO 9', 'azul', t('Comando ou dado', 'Command or data')),
        fio('CS', 'GPIO 10', 'laranja', t('Seleção do chip', 'Chip select')),
        fio('BLK', 'GPIO 7', 'roxo', t('Luz de fundo (PWM)', 'Backlight (PWM)')),
      ],
    },
    comandos: [{ rotulo: t('Instalar as bibliotecas', 'Install the libraries'), linha: 'arduino-cli lib install "Adafruit ST7735 and ST7789 Library" "Adafruit GFX Library"' }, ...gravar('tela-st7789')],
    passos: [
      t('Encaixe a tela na protoboard.', 'Seat the screen on the breadboard.'),
      t('Ligue os oito fios conforme a tabela.', 'Wire the eight leads as in the table.'),
      t('Instale as bibliotecas e grave.', 'Install the libraries and upload.'),
      t('Aperte o BOOT para trocar de tela.', 'Press BOOT to switch screens.'),
    ],
    previa: {
      tipo: 'tela',
      modelo: 'st7789',
      telas: [
        ['RUMO 04', 'ST7789 · 170×320', 'SPI 40 MHz', 'BOOT: próxima'],
        ['RELÓGIO', '14:02:07', 'uptime 00:03:12'],
        ['WI-FI', 'redes: 7', 'melhor: -42 dBm'],
        ['CORES', 'R  G  B', 'RGB565: 16 bits'],
      ],
    },
    explicacaoPrevia: t('Clique na tela ou no botão para simular o BOOT e passar as telas.', 'Click the screen or the button to simulate BOOT and step through screens.'),
    codigo: {
      arquivo: 'tela-st7789/tela-st7789.ino',
      texto: `#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

Adafruit_ST7789 tft(10, 9, 8);
int tela = 0;

void desenhar() {
  tft.fillScreen(ST77XX_BLACK);
  tft.setCursor(10, 20);
  tft.setTextSize(3);
  tft.setTextColor(ST77XX_WHITE);
  const char *titulos[] = {"RUMO 04", "RELOGIO", "WI-FI", "CORES"};
  tft.println(titulos[tela]);
}

void setup() {
  pinMode(7, OUTPUT);
  analogWrite(7, 200);
  pinMode(0, INPUT_PULLUP);
  tft.init(170, 320);
  tft.setRotation(1);
  desenhar();
}

void loop() {
  if (digitalRead(0) == LOW) {
    tela = (tela + 1) % 4;
    desenhar();
    while (digitalRead(0) == LOW) delay(5);
  }
}`,
    },
  },
  {
    id: 'wifi-scan',
    placa: 'esp32-s3',
    tema: 'wifi',
    numero: 5,
    icone: 'wifi',
    titulo: t('Varredura de Wi-Fi', 'Wi-Fi scan'),
    resumo: t('Redes, canais e intensidade do sinal.', 'Networks, channels and signal strength.'),
    pecas: ['rede-wifi'],
    partes: ['antena', 'modulo'],
    como: [
      t('Em modo estação, o rádio passa por cada canal de 2,4 GHz e ouve os beacons que os roteadores mandam cerca de dez vezes por segundo. Cada beacon traz o nome (SSID), o canal e o tipo de segurança.', 'In station mode the radio hops through each 2.4 GHz channel and listens for the beacons routers send about ten times a second. Each beacon carries the name (SSID), channel and security type.'),
      t('O RSSI é a potência recebida em dBm: −40 é excelente, −70 é usável e −90 é quase nada. Cada 3 dB a menos é metade da potência.', 'RSSI is received power in dBm: −40 is excellent, −70 usable and −90 barely there. Every 3 dB less is half the power.'),
    ],
    fiacao: null,
    comandos: gravar('wifi-scan'),
    passos: [
      t('Grave o sketch wifi-scan.', 'Upload the wifi-scan sketch.'),
      t('Veja as redes no monitor.', 'Watch the networks in the monitor.'),
      t('Afaste a placa do roteador e compare o RSSI.', 'Move the board away from the router and compare RSSI.'),
    ],
    previa: { tipo: 'wifi' },
    explicacaoPrevia: t('Redes de exemplo com sinal que oscila como na vida real. Troque entre lista, canais e sinal.', 'Example networks with signal that wobbles like in real life. Switch between list, channels and signal.'),
    codigo: {
      arquivo: 'wifi-scan/wifi-scan.ino',
      texto: `#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
}

void loop() {
  int n = WiFi.scanNetworks();
  Serial.printf("%d redes\\n", n);
  for (int i = 0; i < n; i++) {
    Serial.printf("%-24s ch%2d %4d dBm %s\\n",
      WiFi.SSID(i).c_str(), WiFi.channel(i), WiFi.RSSI(i),
      WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "aberta" : "protegida");
  }
  WiFi.scanDelete();
  delay(5000);
}`,
    },
  },
  {
    id: 'rfid-rc522',
    placa: 'esp32-s3',
    tema: 'rfid',
    numero: 6,
    icone: 'cartao',
    titulo: t('Leitor RC522', 'RC522 reader'),
    resumo: t('UID, setores e um saldo de créditos no cartão.', 'UID, sectors and a credit balance on the card.'),
    pecas: ['rc522', 'protoboard'],
    partes: ['pinos'],
    como: [
      t('A antena do leitor cria um campo de 13,56 MHz. O cartão não tem bateria: tira energia desse campo e responde modulando a carga.', 'The reader antenna makes a 13.56 MHz field. The card has no battery: it harvests the field and answers by modulating the load.'),
      t('Um MIFARE Classic 1K tem 16 setores de 4 blocos de 16 bytes. O bloco 0 guarda o UID gravado de fábrica e o último bloco de cada setor guarda as chaves e as permissões.', 'A MIFARE Classic 1K has 16 sectors of 4 blocks of 16 bytes. Block 0 holds the factory UID and the last block in each sector holds keys and access bits.'),
    ],
    fiacao: {
      modulo: 'RC522',
      ligacoes: [
        fio('SDA', 'GPIO 10', 'laranja', t('Chip select (NSS) no modo SPI, não é dado do I²C', 'Chip select (NSS) in SPI mode, not I²C data')),
        fio('SCK', 'GPIO 12', 'amarelo', t('Relógio do SPI', 'SPI clock')),
        fio('MOSI', 'GPIO 11', 'verde', t('Dados do ESP32 para o chip', 'Data ESP32 to chip')),
        fio('MISO', 'GPIO 13', 'azul', t('Dados do chip para o ESP32', 'Data chip to ESP32')),
        fio('RST', 'GPIO 9', 'branco', t('Reset do leitor', 'Reader reset')),
        fio('GND', 'GND', 'preto', t('Terra comum', 'Common ground')),
        fio('3.3V', '3V3', 'vermelho', t('Nunca em 5 V', 'Never 5 V')),
      ],
    },
    comandos: [{ rotulo: t('Instalar a biblioteca', 'Install the library'), linha: 'arduino-cli lib install MFRC522' }, ...gravar('rfid-rc522')],
    passos: [
      t('Ligue os sete fios; IRQ fica solto.', 'Wire the seven leads; leave IRQ unconnected.'),
      t('Instale a biblioteca e grave.', 'Install the library and upload.'),
      t('Aproxime o cartão e anote o UID.', 'Bring the card close and note the UID.'),
      t('Use + e − para mexer no saldo do bloco 4.', 'Use + and − to change the balance in block 4.'),
    ],
    previa: { tipo: 'rfid' },
    explicacaoPrevia: t('Aproxime o cartão para ler. As abas mostram o chip, a memória setor a setor e um bloco de valor.', 'Bring the card close to read. The tabs show the chip, memory sector by sector and a value block.'),
    codigo: {
      arquivo: 'rfid-rc522/rfid-rc522.ino',
      texto: `#include <SPI.h>
#include <MFRC522.h>

MFRC522 leitor(10, 9);

void setup() {
  Serial.begin(115200);
  SPI.begin(12, 13, 11, 10);
  leitor.PCD_Init();
  Serial.println("aproxime um cartão");
}

void loop() {
  if (!leitor.PICC_IsNewCardPresent() || !leitor.PICC_ReadCardSerial()) return;
  Serial.print("UID:");
  for (byte i = 0; i < leitor.uid.size; i++) Serial.printf(" %02X", leitor.uid.uidByte[i]);
  Serial.printf("  SAK %02X  %s\\n", leitor.uid.sak,
    leitor.PICC_GetTypeName(leitor.PICC_GetType(leitor.uid.sak)));
  leitor.PICC_HaltA();
}`,
    },
  },
  {
    id: 'microfones',
    placa: 'esp32-s3',
    tema: 'sensores',
    numero: 7,
    icone: 'microfone',
    titulo: t('Dois microfones', 'Two microphones'),
    resumo: t('I²S digital contra analógico com comparador.', 'Digital I²S versus analog with a comparator.'),
    pecas: ['inmp441', 'ky037', 'protoboard'],
    partes: ['pinos'],
    como: [
      t('O INMP441 já entrega amostras digitais de 24 bits pelo I²S: SCK é o relógio de bits, WS diz qual canal e SD carrega o som. O KY-037 entrega uma tensão analógica (AO) e uma saída digital (DO) de um comparador LM393.', 'The INMP441 sends 24-bit digital samples over I²S: SCK is the bit clock, WS picks the channel and SD carries the sound. The KY-037 gives an analog voltage (AO) and a digital output (DO) from an LM393 comparator.'),
      t('O potenciômetro azul do KY-037 ajusta o limiar do comparador. Muito baixo e o DO fica sempre aceso; muito alto e uma palma não passa.', 'The KY-037’s blue pot sets the comparator threshold. Too low and DO is always on; too high and a clap never trips it.'),
    ],
    fiacao: {
      modulo: 'INMP441 + KY-037',
      ligacoes: [
        fio('INMP441 SCK', 'GPIO 4', 'amarelo', t('Relógio de bits do I²S', 'I²S bit clock')),
        fio('INMP441 WS', 'GPIO 5', 'azul', t('Seleção de canal', 'Word select')),
        fio('INMP441 SD', 'GPIO 6', 'verde', t('Dados do áudio', 'Audio data')),
        fio('INMP441 L/R', 'GND', 'preto', t('Canal esquerdo', 'Left channel')),
        fio('INMP441 VDD', '3V3', 'vermelho', t('Só 3,3 V', '3.3 V only')),
        fio('KY-037 AO', 'GPIO 1', 'laranja', t('Tensão analógica (ADC1)', 'Analog voltage (ADC1)')),
        fio('KY-037 DO', 'GPIO 2', 'branco', t('Saída do comparador', 'Comparator output')),
        fio('KY-037 +', '3V3', 'vermelho', t('Alimentação', 'Power')),
      ],
    },
    comandos: gravar('microfones'),
    passos: [
      t('Ligue os dois microfones.', 'Wire both microphones.'),
      t('Grave e abra o Serial Plotter.', 'Upload and open the Serial Plotter.'),
      t('Bata uma palma e compare as curvas.', 'Clap once and compare the traces.'),
      t('Ajuste o potenciômetro até o DO acender só na palma.', 'Tune the pot until DO lights only on the clap.'),
    ],
    previa: { tipo: 'microfone' },
    explicacaoPrevia: t('Escolha um som e veja os dois microfones, o nível contínuo do analógico e o comparador.', 'Pick a sound and see both microphones, the analog DC level and the comparator.'),
    codigo: {
      arquivo: 'microfones/microfones.ino',
      texto: `#include <ESP_I2S.h>

I2SClass i2s;
int32_t amostras[256];

void setup() {
  Serial.begin(115200);
  pinMode(2, INPUT);
  i2s.setPins(4, 5, -1, 6);
  i2s.begin(I2S_MODE_STD, 16000, I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO);
}

void loop() {
  size_t lidos = i2s.readBytes((char *)amostras, sizeof(amostras)) / 4;
  int64_t soma = 0;
  for (size_t i = 0; i < lidos; i++) soma += abs(amostras[i] >> 8);
  int digital = lidos ? soma / lidos : 0;
  int analogico = analogRead(1);
  Serial.printf("inmp441:%d ky037:%d do:%d\\n", digital / 64, analogico, digitalRead(2) * 1000);
}`,
    },
  },
  {
    id: 'radar-ble',
    placa: 'esp32-s3',
    tema: 'bluetooth',
    numero: 8,
    icone: 'bluetooth',
    titulo: t('Radar Bluetooth', 'Bluetooth radar'),
    resumo: t('Aparelhos BLE por perto, por intensidade.', 'Nearby BLE devices, by strength.'),
    pecas: ['celular-ble'],
    partes: ['antena', 'modulo'],
    como: [
      t('Aparelhos Bluetooth LE anunciam pacotes nos canais 37, 38 e 39. A varredura ativa ouve esses anúncios e pede mais dados com um scan request.', 'Bluetooth LE devices advertise on channels 37, 38 and 39. An active scan listens to them and asks for more with a scan request.'),
      t('O RSSI não é uma régua: paredes e corpos absorvem 2,4 GHz. Mesmo assim, comparar o RSSI ao longo do tempo diz se algo está chegando perto.', 'RSSI is not a ruler: walls and bodies absorb 2.4 GHz. Still, comparing RSSI over time tells you if something is getting closer.'),
    ],
    fiacao: null,
    comandos: gravar('radar-ble'),
    passos: [
      t('Ligue o Bluetooth do celular.', 'Turn on Bluetooth on the phone.'),
      t('Grave o sketch radar-ble.', 'Upload the radar-ble sketch.'),
      t('Aproxime e afaste o celular e veja o RSSI mudar.', 'Move the phone closer and away and watch RSSI change.'),
    ],
    previa: { tipo: 'radar' },
    explicacaoPrevia: t('Cada ponto é um aparelho: quanto mais perto do centro, mais forte o sinal. Clique num ponto para ver detalhes.', 'Each dot is a device: closer to the centre means a stronger signal. Click a dot for details.'),
    codigo: {
      arquivo: 'radar-ble/radar-ble.ino',
      texto: `#include <BLEDevice.h>

void setup() {
  Serial.begin(115200);
  BLEDevice::init("rumo-radar");
}

void loop() {
  BLEScan *scan = BLEDevice::getScan();
  scan->setActiveScan(true);
  BLEScanResults *achados = scan->start(5, false);
  Serial.printf("%d aparelhos\\n", achados->getCount());
  for (int i = 0; i < achados->getCount(); i++) {
    BLEAdvertisedDevice d = achados->getDevice(i);
    Serial.printf("%s %4d dBm %s\\n", d.getAddress().toString().c_str(), d.getRSSI(),
      d.haveName() ? d.getName().c_str() : "(sem nome)");
  }
  scan->clearResults();
}`,
    },
  },
  {
    id: 'sintetizador',
    placa: 'esp32-s3',
    tema: 'som',
    numero: 9,
    icone: 'som',
    titulo: t('Sintetizador I²S', 'I²S synthesizer'),
    resumo: t('Notas, formas de onda e envelope num alto-falante.', 'Notes, waveforms and envelope on a speaker.'),
    pecas: ['max98357a', 'protoboard'],
    partes: ['pinos'],
    como: [
      t('O ESP32 calcula 16 000 amostras por segundo e manda pelo I²S. O MAX98357A é um amplificador classe D com conversor digital-analógico embutido: recebe os números e move o cone do alto-falante.', 'The ESP32 computes 16,000 samples a second and sends them over I²S. The MAX98357A is a class-D amp with a built-in DAC: it takes the numbers and moves the speaker cone.'),
      t('A forma de onda define o timbre. A senoide é pura; a quadrada tem só harmônicos ímpares e soa “de videogame”; a dente de serra tem todos os harmônicos e soa brilhante.', 'The waveform sets the timbre. A sine is pure; a square has only odd harmonics and sounds “video game”; a saw has every harmonic and sounds bright.'),
    ],
    fiacao: {
      modulo: 'MAX98357A',
      ligacoes: [
        fio('LRC', 'GPIO 16', 'azul', t('Relógio de quadro (WS)', 'Frame clock (WS)')),
        fio('BCLK', 'GPIO 15', 'amarelo', t('Relógio de bits', 'Bit clock')),
        fio('DIN', 'GPIO 17', 'verde', t('Amostras de áudio', 'Audio samples')),
        fio('GND', 'GND', 'preto', t('Terra comum', 'Common ground')),
        fio('VIN', '5V', 'vermelho', t('5 V dão mais volume', '5 V gives more volume')),
      ],
    },
    comandos: gravar('sintetizador'),
    passos: [
      t('Ligue o amplificador e o alto-falante.', 'Wire the amp and speaker.'),
      t('Grave e digite uma nota, como a4.', 'Upload and type a note, like a4.'),
      t('Troque a forma com wave square.', 'Switch waveform with wave square.'),
    ],
    previa: { tipo: 'sintetizador' },
    explicacaoPrevia: t('Toque as teclas (ou A S D F G H J K no teclado). O som sai do seu navegador, com a mesma forma de onda.', 'Play the keys (or A S D F G H J K on your keyboard). Sound comes from your browser with the same waveform.'),
    codigo: {
      arquivo: 'sintetizador/sintetizador.ino',
      texto: `#include <ESP_I2S.h>

I2SClass i2s;
const int TAXA = 16000;
float frequencia = 440, fase = 0;

void setup() {
  Serial.begin(115200);
  i2s.setPins(15, 16, 17);
  i2s.begin(I2S_MODE_STD, TAXA, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO);
}

void loop() {
  if (Serial.available()) frequencia = Serial.parseFloat();
  int16_t bloco[128];
  for (int i = 0; i < 128; i++) {
    bloco[i] = sinf(fase) * 6000;
    fase += 2 * PI * frequencia / TAXA;
    if (fase > 2 * PI) fase -= 2 * PI;
  }
  i2s.write((uint8_t *)bloco, sizeof(bloco));
}`,
    },
  },
];
