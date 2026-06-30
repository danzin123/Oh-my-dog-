require('dotenv').config();
const { thermalPrinter: ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const PRINT_TOKEN = process.env.PRINT_TOKEN || 'oh-my-dog-print-secret-token-123';
const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || 'tcp://192.168.1.100:9100';
const PRINTER_TYPE = process.env.PRINTER_TYPE === 'STAR' ? PrinterTypes.STAR : PrinterTypes.EPSON;
const POLLING_INTERVAL_MS = parseInt(process.env.POLLING_INTERVAL_MS || '5000', 10);

console.log('=============================================');
console.log('      INICIANDO AGENTE DE IMPRESSÃO          ');
console.log('              OH MY DOG                      ');
console.log('=============================================');
console.log(`Backend: ${BACKEND_URL}`);
console.log(`Impressora: ${PRINTER_INTERFACE} (${process.env.PRINTER_TYPE || 'EPSON'})`);
console.log(`Intervalo de Polling: ${POLLING_INTERVAL_MS}ms`);
console.log('=============================================');

async function testPrinterConnection() {
  const printer = new ThermalPrinter({
    type: PRINTER_TYPE,
    interface: PRINTER_INTERFACE,
  });

  try {
    const isConnected = await printer.isPrinterConnected();
    if (isConnected) {
      console.log('✔ Conexão com a impressora térmica estabelecida com sucesso!');
    } else {
      console.warn('⚠ Impressora não respondeu. Certifique-se de que está ligada e conectada corretamente.');
    }
  } catch (err) {
    console.error('✖ Erro ao testar conexão com a impressora:', err.message);
  }
}

async function printReceipt(order) {
  const printer = new ThermalPrinter({
    type: PRINTER_TYPE,
    interface: PRINTER_INTERFACE,
    characterSet: 'SLOVENIA', // Codificação adequada para acentos PT-BR em muitas impressoras
    removeSpecialCharacters: false,
    options: {
      timeout: 5000
    }
  });

  try {
    printer.clear();
    
    // Cabeçalho
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.setTextDoubleWidth();
    printer.bold(true);
    printer.println('OH MY DOG');
    printer.setTextNormal();
    
    printer.println('--------------------------------');
    printer.setTextDoubleHeight();
    printer.println(`PEDIDO: #${order.id.slice(-6).toUpperCase()}`);
    printer.setTextNormal();
    printer.println('--------------------------------');

    // Informações do Cliente
    printer.alignLeft();
    printer.bold(false);
    printer.println(`Cliente: ${order.clientName}`);
    printer.println(`Telefone: ${order.clientPhone}`);
    printer.println(`Data: ${new Date(order.createdAt).toLocaleString('pt-BR')}`);
    printer.println(`Pagamento: ${order.paymentMethod === 'PIX' ? 'PIX' : 'CARTÃO DE CRÉDITO'}`);
    printer.println('--------------------------------');

    // Itens do Pedido
    printer.bold(true);
    printer.println('ITENS DO PEDIDO:');
    printer.bold(false);
    
    order.items.forEach(item => {
      printer.setTextDoubleHeight();
      printer.println(`${item.quantity}x ${item.productName}`);
      printer.setTextNormal();
      
      if (order.notes) {
        printer.bold(true);
        printer.println(`   * OBS: ${order.notes}`);
        printer.bold(false);
      }
      printer.println('');
    });

    printer.println('--------------------------------');
    
    // Total
    printer.alignRight();
    printer.bold(true);
    printer.setTextDoubleHeight();
    printer.println(`TOTAL: R$ ${parseFloat(order.total).toFixed(2)}`);
    
    // Rodapé
    printer.alignCenter();
    printer.setTextNormal();
    printer.bold(false);
    printer.println('\n\nOh my Dog!');
    printer.println('Obrigado pela preferencia!');
    
    // Pular linhas e cortar
    printer.cut();

    await printer.execute();
    console.log(`✔ Pedido #${order.id.slice(-6).toUpperCase()} impresso com sucesso!`);
    return true;
  } catch (err) {
    console.error(`✖ Falha ao imprimir pedido #${order.id.slice(-6).toUpperCase()}:`, err.message);
    return false;
  }
}

async function checkQueue() {
  try {
    // Buscar fila de impressão no Backend
    const response = await fetch(`${BACKEND_URL}/api/admin/print-queue`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRINT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error('✖ Erro de Autenticação: Token de impressão incorreto.');
      } else {
        console.error(`✖ Erro ao buscar fila: Servidor retornou código ${response.status}`);
      }
      return;
    }

    const data = await response.json();
    const queue = data.queue || [];

    if (queue.length > 0) {
      console.log(`Fila: ${queue.length} pedido(s) pendente(s) localizado(s).`);
      
      for (const item of queue) {
        // Tentar imprimir o pedido
        const printSuccess = await printReceipt(item.order);
        
        if (printSuccess) {
          // Confirmar para o backend que o pedido foi impresso
          await confirmPrint(item.printQueueId);
        }
      }
    }
  } catch (err) {
    console.error('✖ Erro de conexão com o servidor Backend:', err.message);
  }
}

async function confirmPrint(printQueueId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/print-queue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRINT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ printQueueId })
    });

    if (response.ok) {
      console.log(`✔ Impressão do item ${printQueueId} confirmada no servidor.`);
    } else {
      console.error(`✖ Falha ao confirmar impressão no servidor: Status ${response.status}`);
    }
  } catch (err) {
    console.error('✖ Erro de conexão ao confirmar impressão:', err.message);
  }
}

// Iniciar conexão inicial
testPrinterConnection();

// Iniciar loop de consulta (polling)
setInterval(checkQueue, POLLING_INTERVAL_MS);
console.log('Aguardando novos pedidos...');
checkQueue();
