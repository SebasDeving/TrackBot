const { MessageEmbed } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const moment = require('moment');
const connectToDatabase = require('../database/connect.js');
const { connection } = connectToDatabase();

const canal_recibir_pedidos = '1378900572182417418';
const canal_encamino = '1378892672558825494';
const canal_pendiente = '1379184470527049869';
const canal_entregado = '1378863113096396990';
const canal_disponible = '1378863085254610954';

async function obtenerEstadoEnvio(trackingNumber) {
  const url = `https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=${trackingNumber}`;
  let browser;
  try {
    // Intentar usar un Chrome/Chromium instalado en el sistema si existe
    const defaultPaths = [
      process.env.CHROME_PATH, // permite override por variable de entorno
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
    ].filter(Boolean);

    const fs = require('fs');

    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    };

    // Si encontramos un ejecutable válido, lo usamos para evitar dependencia de la caché de puppeteer
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

async function guardarEnBaseDeDatos({ idenvio, tracking_number, estado, idmensaje_discord }) {
  const sql = `INSERT INTO envios_tracking (idenvio, tracking_number, estado, idmensaje_discord) VALUES (?, ?, ?, ?)`;
  return new Promise((resolve, reject) => {
    connection.query(sql, [idenvio, tracking_number, estado, idmensaje_discord], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function trackingExiste(tracking_number) {
  const sql = `SELECT * FROM envios_tracking WHERE tracking_number = ? LIMIT 1`;
  return new Promise((resolve, reject) => {
    connection.query(sql, [tracking_number], (err, results) => {
      if (err) return reject(err);
      resolve(results.length > 0);
    });
  });
}




async function eliminarTracking(client, message, trackingNumber) {
  try {
    const sqlSelect = 'SELECT * FROM envios_tracking WHERE tracking_number = ? LIMIT 1';
    const [rows] = await new Promise((resolve, reject) => {
      connection.query(sqlSelect, [trackingNumber], (err, results) => {
        if (err) reject(err);
        else resolve([results]);
      });
    });

    if (rows.length === 0) {
      return message.reply(`⚠️ No se encontró ningún registro con el tracking \`${trackingNumber}\`.`);
    }

    const registro = rows[0];

    // Intentar eliminar el mensaje del bot
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
          console.log(`🗑️ Mensaje eliminado del canal ${canal.name}`);
          break;
        }
      } catch (e) {}
    }

    // Eliminar de la base de datos
    const sqlDelete = 'DELETE FROM envios_tracking WHERE tracking_number = ?';
    await new Promise((resolve, reject) => {
      connection.query(sqlDelete, [trackingNumber], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await message.reply(`✅ El tracking \`${trackingNumber}\` fue eliminado correctamente.`);
    console.log(`✅ Eliminado de la base de datos: ${trackingNumber}`);

  } catch (error) {
    console.error('❌ Error al eliminar el tracking:', error);
    message.reply('❌ Hubo un error al intentar eliminar el tracking.');
  }
}



async function listarTrackings(message) {
  try {
    const sql = 'SELECT tracking_number, estado FROM envios_tracking ORDER BY idenvio DESC';
    const [rows] = await new Promise((resolve, reject) => {
      connection.query(sql, (err, results) => {
        if (err) reject(err);
        else resolve([results]);
      });
    });

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
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(bloques[i])
        .addFields({ name: 'Usuario', value: message.author.username, inline: true },)
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


       // 🔹 Si el mensaje comienza con !eliminar
      if (message.content.startsWith('!eliminar')) {
        const args = message.content.split(' ');
        const trackingNumber = args[1];

        if (!trackingNumber) {
          return message.reply('⚠️ Debes especificar el número de tracking. Ejemplo: `!eliminar LB123456789ES`');
        }

        return eliminarTracking(client, message, trackingNumber);
      }

      
      if (message.content.startsWith('!list') || message.content.startsWith('!lista')) {
        return listarTrackings(message);
      }


      if (message.channel.id !== canal_recibir_pedidos) return;

      // Normalizar entrada para evitar duplicados por mayúsculas/minúsculas
      const rawTracking = message.content.trim();
      const trackingNumber = rawTracking.toUpperCase();

      // Validar formato (solo letras y números, mínimo 10) sobre la versión normalizada
      if (!trackingNumber.match(/^([A-Z0-9]{10,})$/)) return;

      // Comprobar existencia antes de cualquier otra acción.
      const yaExiste = await trackingExiste(trackingNumber);
      if (yaExiste) {
        await message.reply({
          content: `El tracking ${trackingNumber} ya existe en la base de datos. Este codigo ya esta en seguimiento`,
          allowedMentions: { repliedUser: false }
        });
        return;
      }

      const estado = await obtenerEstadoEnvio(trackingNumber);

      let canalDestino;
      if (estado.includes('ENTREGADO')) canalDestino = canal_entregado;
      else if (estado.includes('EN CAMINO')) canalDestino = canal_encamino;
      else if (estado.includes('PRE-ADMISIÓN')) canalDestino = canal_pendiente;
      else if (estado.includes('EN ENTREGA')) canalDestino = canal_disponible;
      else canalDestino = message.channel.id;

    // Formatear fecha/hora del mensaje (en español)
    moment.locale('es');
    const fechaMensaje = moment(message.createdAt).format('D/MM/YYYY h:mm a');

    const embed = new MessageEmbed()
      .setTitle('📦 Seguimiento de envío')
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: 'Tracking Number', value: trackingNumber, inline: true },
        { name: 'Estado', value: estado, inline: true },
        { name: 'Usuario', value: message.author.username, inline: true },
        { name: 'Fecha', value: fechaMensaje, inline: false }
      )
      .setColor('#FFD700')
      .setTimestamp();

      const canal = await client.channels.fetch(canalDestino);
      const mensajeBot = await canal.send({ embeds: [embed] });

      const idenvio = uuidv4();

      await guardarEnBaseDeDatos({
        idenvio,
        tracking_number: trackingNumber,
        estado,
        idmensaje_discord: mensajeBot.id
      });

      await message.delete();
      console.log(`✅ Guardado: ${trackingNumber} - ${estado}`);
    } catch (error) {
      console.error('❌ Error al procesar el tracking:', error);
    }
  }
};
