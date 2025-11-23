const { MessageEmbed } = require('discord.js');
const puppeteer = require('puppeteer'); 
const connectToDatabase = require('../database/connect.js');
const { connection } = connectToDatabase();

const canal_encamino = '1378892672558825494';
const canal_pendiente = '1379184470527049869';
const canal_entregado = '1378863113096396990';
const canal_disponible = '1378863085254610954';

async function eliminarEnvioDeBD(idenvio) {
  const sql = `DELETE FROM envios_tracking WHERE idenvio = ?`;
  return new Promise((resolve, reject) => {
    connection.query(sql, [idenvio], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}


async function obtenerEstadoEnvio(trackingNumber) {
  const url = `https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=${trackingNumber}`;
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('span.correos-ui-tracking-stepper__title', { timeout: 10000 });

    const estado = await page.evaluate(() => {
      const span = document.querySelector('span.correos-ui-tracking-stepper__title');
      return span?.textContent?.trim() || 'No encontrado';
    });

    return estado;
  } catch (err) {
    console.error('Error obteniendo estado del tracking:', err.message);
    return 'Error de conexión';
  } finally {
    if (browser) await browser.close();
  }
}


function getCanalPorEstado(estado) {
  if (estado.includes('ENTREGADO')) return canal_entregado;
  if (estado.includes('EN CAMINO')) return canal_encamino;
  if (estado.includes('PRE-ADMISIÓN')) return canal_pendiente;
  if (estado.includes('EN ENTREGA')) return canal_disponible;
  return null;
}

async function actualizarEstadoEnBD(idenvio, nuevoEstado, nuevoIdMensaje) {
  const sql = `UPDATE envios_tracking SET estado = ?, idmensaje_discord = ? WHERE idenvio = ?`;
  return new Promise((resolve, reject) => {
    connection.query(sql, [nuevoEstado, nuevoIdMensaje, idenvio], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function obtenerTrackings() {
  const sql = `SELECT * FROM envios_tracking`;
  return new Promise((resolve, reject) => {
    connection.query(sql, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

module.exports = {
  name: 'ready',
  once: true,
  run: async (client) => {
    console.log(`✅ Bot listo: ${client.user.tag}`);

    setInterval(async () => {
      try {
        const registros = await obtenerTrackings();

        for (const registro of registros) {
  const { idenvio, tracking_number, estado: estadoAnterior, idmensaje_discord } = registro;

  console.log(`🔎 Revisando tracking: ${tracking_number} (Estado anterior: ${estadoAnterior})`);

  const estadoActual = await obtenerEstadoEnvio(tracking_number);

  // Mostrar el estado obtenido
  console.log(`📡 Estado obtenido: ${estadoActual}`);

  // Si hubo error o el estado no cambió, no hacer nada
  if (
    !estadoActual || 
    estadoActual === 'Error de conexión' || 
    estadoActual === 'No encontrado' || 
    estadoActual.trim() === estadoAnterior.trim()
  ) {
    console.log(`⏭️ Sin cambios para ${tracking_number}, se mantiene el estado: ${estadoAnterior}`);
    continue; // pasa al siguiente tracking sin enviar nada
  }

  // Si el estado sí cambió:
  const canalNuevoId = getCanalPorEstado(estadoActual);
  if (!canalNuevoId) {
    console.log(`⚠️ No se encontró un canal asociado para el estado "${estadoActual}"`);
    continue;
  }

  const embed = new MessageEmbed()
    .setTitle(`📦 Seguimiento actualizado`)
    .addField('Tracking Number', tracking_number, true)
    .addField('Estado', estadoActual, true)
    .setColor('#00BFFF')
    .setTimestamp();

  try {
    // Eliminar mensaje anterior si existe
    for (const canalId of [canal_encamino, canal_pendiente, canal_entregado, canal_disponible]) {
      const canal = await client.channels.fetch(canalId);
      const msg = await canal.messages.fetch(idmensaje_discord).catch(() => null);
      if (msg) {
        await msg.delete();
        break;
      }
    }

    // Enviar nuevo mensaje
    const canalNuevo = await client.channels.fetch(canalNuevoId);
    const nuevoMensaje = await canalNuevo.send({ embeds: [embed] });

    if (estadoActual.includes('ENTREGADO')) {
      await eliminarEnvioDeBD(idenvio);
      console.log(`✅ Entrega completada y eliminada de la base de datos: ${tracking_number}`);
    } else {
      await actualizarEstadoEnBD(idenvio, estadoActual, nuevoMensaje.id);
      console.log(`🔁 Estado actualizado: ${tracking_number} | ${estadoAnterior} ➜ ${estadoActual}`);
    }
  } catch (err) {
    console.error(`❌ Error al actualizar mensaje del tracking ${tracking_number}:`, err);
  }

  await sleep(3000);
}


      } catch (err) {
        console.error('❌ Error en el seguimiento automático:', err);
      }
    }, 60000); 
  }
};


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}