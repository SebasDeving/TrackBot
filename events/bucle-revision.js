const { MessageEmbed } = require('discord.js');
const puppeteer = require('puppeteer');

const connectToDatabase = require('../database/connect.js');
const db = connectToDatabase().query;

const CANALES = {
  ENC_CAMINO: '1378892672558825494',
  PENDIENTE: '1379184470527049869',
  ENTREGADO: '1378863113096396990',
  DISPONIBLE: '1378863085254610954'
};

const TRACKING_BASE_URL =
  'https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=';
const CHECK_INTERVAL_MS = 60000;
const FETCH_DELAY_MS = 3000;

let isChecking = false;

async function eliminarEnvioDeBD(idenvio) {
  const sql = 'DELETE FROM envios_tracking WHERE idenvio = ?';
  return db(sql, [idenvio]);
}

async function actualizarEstadoEnBD(idenvio, nuevoEstado, nuevoIdMensaje) {
  const sql = 'UPDATE envios_tracking SET estado = ?, idmensaje_discord = ? WHERE idenvio = ?';
  return db(sql, [nuevoEstado, nuevoIdMensaje, idenvio]);
}

async function obtenerTrackings() {
  return db('SELECT * FROM envios_tracking');
}

function normalizarEstado(texto) {
  return (texto || '').trim().toUpperCase();
}

function getCanalPorEstado(estado) {
  if (estado.includes('ENTREGADO')) return CANALES.ENTREGADO;
  if (estado.includes('EN CAMINO')) return CANALES.ENC_CAMINO;
  if (estado.includes('PRE-ADMISION') || estado.includes('PRE-ADMISIÓN')) return CANALES.PENDIENTE;
  if (estado.includes('EN ENTREGA')) return CANALES.DISPONIBLE;
  return null;
}

async function obtenerEstadoEnvio(trackingNumber) {
  const url = `${TRACKING_BASE_URL}${trackingNumber}`;
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('span.correos-ui-tracking-stepper__title', { timeout: 10000 });

    const estado = await page.evaluate(() => {
      const span = document.querySelector('span.correos-ui-tracking-stepper__title');
      return span?.textContent?.trim() || 'No encontrado';
    });

    return estado;
  } catch (err) {
    console.error('Error obteniendo estado del tracking:', err.message);
    return 'Error de conexion';
  } finally {
    if (browser) await browser.close();
  }
}

async function eliminarMensajeAnterior(client, idMensaje) {
  if (!idMensaje) return;

  for (const canalId of Object.values(CANALES)) {
    try {
      const canal = await client.channels.fetch(canalId);
      const msg = await canal.messages.fetch(idMensaje).catch(() => null);
      if (msg) {
        await msg.delete();
        return;
      }
    } catch (err) {
      // Silenciar errores por canal inexistente o sin permisos.
    }
  }
}

function crearEmbed(trackingNumber, estado) {
  return new MessageEmbed()
    .setTitle('📦 Seguimiento actualizado')
    .addField('Tracking Number', trackingNumber, true)
    .addField('Estado', estado, true)
    .setColor('#00BFFF')
    .setTimestamp();
}

async function procesarRegistro(client, registro) {
  const { idenvio, tracking_number, estado: estadoAnterior, idmensaje_discord } = registro;

  const estadoActual = await obtenerEstadoEnvio(tracking_number);
  console.log(`📡 Estado obtenido para ${tracking_number}: ${estadoActual}`);

  const estadoPrevio = normalizarEstado(estadoAnterior);
  const estadoNuevo = normalizarEstado(estadoActual);

  if (!estadoNuevo || estadoNuevo === 'ERROR DE CONEXION' || estadoNuevo === 'NO ENCONTRADO') {
    console.log(`⏭️ Sin cambios (estado no valido) para ${tracking_number}`);
    return;
  }

  if (estadoNuevo === estadoPrevio) {
    console.log(`⏭️ Sin cambios para ${tracking_number}`);
    return;
  }

  const canalNuevoId = getCanalPorEstado(estadoNuevo);
  if (!canalNuevoId) {
    console.log(`⚠️ No se encontro canal para el estado "${estadoActual}"`);
    return;
  }

  const embed = crearEmbed(tracking_number, estadoActual);

  try {
    await eliminarMensajeAnterior(client, idmensaje_discord);

    const canalNuevo = await client.channels.fetch(canalNuevoId);
    const nuevoMensaje = await canalNuevo.send({ embeds: [embed] });

    if (estadoNuevo.includes('ENTREGADO')) {
      await eliminarEnvioDeBD(idenvio);
      console.log(`✅ Eliminado (entregado): ${tracking_number}`);
    } else {
      await actualizarEstadoEnBD(idenvio, estadoActual, nuevoMensaje.id);
      console.log(`🔁 Estado actualizado: ${estadoAnterior} -> ${estadoActual}`);
    }
  } catch (err) {
    console.error(`❌ Error actualizando mensaje para ${tracking_number}:`, err);
  }
}

async function ejecutarRevision(client) {
  if (isChecking) return; // Evita solapes si una revision tarda mas que el intervalo.
  isChecking = true;

  try {
    const registros = await obtenerTrackings();
    for (const registro of registros) {
      try {
        await procesarRegistro(client, registro);
      } catch (err) {
        console.error('❌ Error procesando registro:', err);
      }

      await sleep(FETCH_DELAY_MS);
    }
  } catch (err) {
    console.error('❌ Error en seguimiento automatico:', err);
  } finally {
    isChecking = false;
  }
}

module.exports = {
  name: 'ready',
  once: true,
  run: async (client) => {
    console.log(`✅ Bot listo: ${client.user.tag}`);
    setInterval(() => ejecutarRevision(client), CHECK_INTERVAL_MS);
  }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
