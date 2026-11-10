import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (erro) => {
    throw erro;
  });
});

test('abre na ESP32-S3 com bancada, vista 3D e os nove labs', async ({ page }) => {
  await page.goto('./#/esp32-s3');
  await expect(page.locator('.heroi-titulo')).toContainText('ESP32-S3');
  await expect(page.locator('.cartao-parte')).toHaveCount(8);
  await expect(page.locator('#labs .ladrilho')).toHaveCount(9);
  await expect(page.locator('.janela-aba[data-aba="3d"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.visor3d canvas')).toBeVisible();
  await expect(page.locator('.visor3d-status')).toContainText('esp32-s3.kicad_pcb');
});

test('gira a placa nos três eixos e separa as peças', async ({ page }) => {
  await page.goto('./#/pi5');
  const visor = page.locator('.visor3d');
  await expect(visor).toHaveAttribute('data-pose', '56,0,-24');
  for (const [i, valor] of [[0, '20'], [1, '45'], [2, '90']] as const) {
    await page.locator('.eixo input').nth(i).fill(valor);
  }
  await expect(visor).toHaveAttribute('data-pose', '20,45,90');
  await page.locator('.botao-explodir').click();
  await expect(visor).toHaveAttribute('data-explodido', 'true');
  await visor.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.eixo-valor').nth(2)).toHaveText('100°');
  await expect(visor).toHaveAttribute('data-pose', '20,45,100');
});

test('escolher uma parte acende a peça no 3D e no editor de PCB', async ({ page }) => {
  await page.goto('./#/atx');
  await page.locator('.cartao-parte[data-parte="ram"]').click();
  await expect(page.locator('.cartao-parte[data-parte="ram"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.visor3d')).toHaveAttribute('data-acesa', 'ram');
  await page.locator('.janela-aba[data-aba="pcb"]').click();
  await expect(page.locator('.janela')).toHaveAttribute('data-aba', 'pcb');
  await expect(page.locator('.editor')).toHaveAttribute('data-acesa', 'ram');
  await expect(page.locator('.k-alvo[data-parte="ram"]')).toHaveCount(4);
  await expect(page.locator('.editor-painel')).toContainText('Connector_PCBEdge');
});

test('o editor de PCB liga e desliga camadas', async ({ page }) => {
  await page.goto('./#/esp32-s3');
  await page.locator('.janela-aba[data-aba="pcb"]').click();
  const camada = page.locator('.editor-svg [data-camada="F.Cu"]');
  await expect(camada).toBeVisible();
  await page.locator('.editor-painel').getByRole('checkbox', { name: 'F.Cu', exact: true }).uncheck();
  await expect(camada).toBeHidden();
  await expect(page.locator('.editor-svg .k-pad-tht').first()).toBeAttached();
});

test('o catálogo mostra as 32 placas e abre uma delas', async ({ page }) => {
  await page.goto('./#/placas');
  await expect(page.locator('.cartao-placa')).toHaveCount(32);
  await page.locator('.cartao-placa[data-placa="gpu"]').click();
  await expect(page).toHaveURL(/#\/gpu$/);
  await expect(page.locator('.aviso-sem-labs')).toBeVisible();
});

test('marcar peças libera labs e os passos ficam salvos', async ({ page }) => {
  await page.goto('./#/esp32-s3');
  await page.locator('.peca-chip[data-peca="rc522"]').click();
  await page.locator('.peca-chip[data-peca="protoboard"]').click();
  await expect(page.locator('.bancada-total strong')).toHaveText('4');
  await page.goto('./#/esp32-s3/ola');
  const caixas = page.locator('.lab-passos input');
  await expect(caixas).toHaveCount(4);
  for (let i = 0; i < 4; i++) await caixas.nth(i).check();
  await expect(page.locator('.lab-cabeca')).toHaveClass(/feito/);
  await page.reload();
  await expect(page.locator('.lab-passos input:checked')).toHaveCount(4);
  await page.goto('./#/esp32-s3');
  await expect(page.locator('#labs .ladrilho.sit-feito')).toHaveCount(1);
  await expect(page.locator('.progresso')).toHaveCount(0);
});

test('o monitor serial responde aos comandos e o LED muda', async ({ page }) => {
  await page.goto('./#/esp32-s3/led-rgb');
  await page.locator('.serial-chips .chip', { hasText: 'sos' }).click();
  await expect(page.locator('.sim-led')).toHaveAttribute('data-modo', 'sos');
  await page.locator('.serial-campo').fill('xyz');
  await page.keyboard.press('Enter');
  await expect(page.locator('.serial-erro').last()).toContainText('xyz');
});

test('a fiação anda fio a fio', async ({ page }) => {
  await page.goto('./#/esp32-s3/rfid-rc522');
  await expect(page.locator('.fiacao-svg .fio')).toHaveCount(7);
  await page.locator('.fiacao-controles .botao').nth(2).click();
  await expect(page.locator('.fiacao-svg .fio')).toHaveCount(1);
  await expect(page.locator('.fiacao-status')).toContainText('SDA');
});

test('busca por lab, troca de idioma e tema pelo teclado', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./#/esp32-s3');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
  await page.keyboard.press('Control+k');
  await page.locator('.busca-campo').fill('ponte h');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/l298n/);
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('l');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.keyboard.press('t');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
});

test('troca a paleta pelo menu e pelo teclado e mantém a escolha', async ({ page }) => {
  await page.goto('./#/esp32-s3');
  const raiz = page.locator('html');
  await expect(raiz).not.toHaveAttribute('data-paleta', /.+/);
  await page.locator('.cabecalho .paleta').click();
  await expect(page.locator('.menu .menu-item')).toHaveCount(4);
  await expect(page.locator('.menu')).toHaveText('');
  await page.getByRole('menuitemradio', { name: 'Paleta Bento' }).click();
  await expect(raiz).toHaveAttribute('data-paleta', 'bento');
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('c');
  await expect(raiz).toHaveAttribute('data-paleta', 'sonda');
  await page.reload();
  await expect(raiz).toHaveAttribute('data-paleta', 'sonda');
  await expect(page.locator('.barra-status')).toContainText('Paleta Sonda');
});

test('mostra a marca e a barra de status', async ({ page }) => {
  await page.goto('./#/esp32-s3');
  await expect(page.locator('.marca-nome')).toHaveText('Rumo');
  await expect(page.locator('.heroi-titulo')).toHaveText('ESP32-S3 Labs');
  await expect(page.locator('.barra-status')).toContainText('ESP32-S3 DevKitC-1');
});
