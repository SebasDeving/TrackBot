const { MessageEmbed } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const moment = require('moment');

// YA NO SE CONECTA A LA BD AQUÍ
// TODA LA BD SE USA DESDE client.db

const canal_recibir_pedidos = '1378900572182417418';
const canal_encamino = '1378892672558825494';
const canal_pendiente = '1379184470527049869';
const canal_entregado = '1378863113096396990';
const canal_disponible = '1378863085254610954';

async function obtenerEstadoEnvio(trackingNumber) {
  const url = `https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=${trackingNumber}`;
  let browser;

  try {
    const defaultPaths = [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
    ].filter(Boolean);

    const fs = require('fs');

    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    };

    for (const p of defaultPaths) {
      if (!p) continue;
      try {
        if (fs.existsSync(p)) {
          launchOptions.executablePath = p;
          break;
        }
      } catch (e) {}
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('span.correos-ui-tracking-stepper__title', { timeout: 40000 });

    const estado = await page.evaluate(() => {
      const span = document.querySelector('span.correos-ui-tracking-stepper__title');
      return span?.textContent?.trim() || 'No encontrado';
    });

    return estado;

  } catch (err) {
    console.error('Error obteniendo estado del tracking:', err.message || err);
    return 'Error de conexión';
  } finally {
    if (browser) await browser.close();
  }
}

async function guardarEnBaseDeDatos(client, { idenvio, tracking_number, estado, idmensaje_discord }) {
  const sql = `INSERT INTO envios_tracking (idenvio, tracking_number, estado, idmensaje_discord) VALUES (?, ?, ?, ?)`;
  return client.db.query(sql, [idenvio, tracking_number, estado, idmensaje_discord]);
}

async function trackingExiste(client, tracking_number) {
  const sql = `SELECT * FROM envios_tracking WHERE tracking_number = ? LIMIT 1`;
  const rows = await client.db.query(sql, [tracking_number]);
  return rows.length > 0;
}

async function eliminarTracking(client, message, trackingNumber) {
  try {
    const sqlSelect = 'SELECT * FROM envios_tracking WHERE tracking_number = ? LIMIT 1';
    const rows = await client.db.query(sqlSelect, [trackingNumber]);

    if (rows.length === 0) {
      return message.reply(`⚠️ No se encontró ningún registro con el tracking \`${trackingNumber}\`.`);
    }

    const registro = rows[0];

    const canales = [
      canal_encamino,
      canal_pendiente,
      canal_entregado,
      canal_disponible,
      canal_recibir_pedidos
    ];

    for (const canalId of canales) {
      try {
        const canal = await client.channels.fetch(canalId);
        const mensaje = await canal.messages.fetch(registro.idmensaje_discord).catch(() => null);
        if (mensaje) {
          await mensaje.delete();
          break;
        }
      } catch (e) {}
    }

    const sqlDelete = 'DELETE FROM envios_tracking WHERE tracking_number = ?';
    await client.db.query(sqlDelete, [trackingNumber]);

    await message.reply(`✅ El tracking \`${trackingNumber}\` fue eliminado correctamente.`);

  } catch (error) {
    console.error('❌ Error al eliminar el tracking:', error);
    message.reply('❌ Hubo un error al intentar eliminar el tracking.');
  }
}

async function listarTrackings(client, message) {
  try {
    const sql = 'SELECT tracking_number, estado FROM envios_tracking ORDER BY idenvio DESC';
    const rows = await client.db.query(sql);

    if (rows.length === 0) {
      return message.reply('📭 No hay ningún tracking registrado actualmente.');
    }

    const bloques = [];
    let bloque = '';

    rows.forEach((r, i) => {
      bloque += `**${i + 1}.** \`${r.tracking_number}\` → **${r.estado}**\n`;
      if ((i + 1) % 10 === 0 || i + 1 === rows.length) {
        bloques.push(bloque);
        bloque = '';
      }
    });

    for (let i = 0; i < bloques.length; i++) {
      const embed = new MessageEmbed()
        .setTitle('📋 Lista de Envíos Registrados')
        .setDescription(bloques[i])
        .setColor('#00BFFF')
        .setFooter({ text: `Página ${i + 1}/${bloques.length}` })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
    }

  } catch (error) {
    console.error('❌ Error al listar trackings:', error);
    message.reply('❌ Hubo un error al intentar obtener la lista de trackings.');
  }
}

module.exports = {
  name: 'messageCreate',
  run: async (client, message) => {
    try {
      const allowedBotTag = 'gab#3397';
      if (message.author.bot && message.author.tag !== allowedBotTag) return;

      if (message.content.startsWith('!eliminar')) {
        const args = message.content.split(' ');
        const trackingNumber = args[1];
        if (!trackingNumber) {
          return message.reply('⚠️ Debes especificar el número de tracking. Ejemplo: `!eliminar LB123456789ES`');
        }
        return eliminarTracking(client, message, trackingNumber);
      }

      if (message.content.startsWith('!list') || message.content.startsWith('!lista')) {
        return listarTrackings(client, message);
      }

      if (message.channel.id !== canal_recibir_pedidos) return;

      const rawTracking = message.content.trim();
      const trackingNumber = rawTracking.toUpperCase();

      if (!trackingNumber.match(/^([A-Z0-9]{10,})$/)) return;

      const yaExiste = await trackingExiste(client, trackingNumber);
      if (yaExiste) {
        return message.reply(`⚠️ El tracking \`${trackingNumber}\` ya existe.`);
      }

      const estado = await obtenerEstadoEnvio(trackingNumber);

      let canalDestino;
      if (estado.includes('ENTREGADO')) canalDestino = canal_entregado;
      else if (estado.includes('EN CAMINO')) canalDestino = canal_encamino;
      else if (estado.includes('PRE-ADMISIÓN')) canalDestino = canal_pendiente;
      else if (estado.includes('EN ENTREGA')) canalDestino = canal_disponible;
      else canalDestino = message.channel.id;

      moment.locale('es');
      const fechaMensaje = moment(message.createdAt).format('D/MM/YYYY h:mm a');

      const embed = new MessageEmbed()
        .setTitle('📦 Seguimiento de envío')
        .addFields(
          { name: 'Tracking Number', value: trackingNumber },
          { name: 'Estado', value: estado },
          { name: 'Fecha', value: fechaMensaje }
        )
        .setColor('#FFD700')
        .setTimestamp();

      const canal = await client.channels.fetch(canalDestino);
      const mensajeBot = await canal.send({ embeds: [embed] });

      const idenvio = uuidv4();

      await guardarEnBaseDeDatos(client, {
        idenvio,
        tracking_number: trackingNumber,
        estado,
        idmensaje_discord: mensajeBot.id
      });

      await message.delete();

    } catch (error) {
      console.error('❌ Error al procesar el tracking:', error);
    }
  }
};

