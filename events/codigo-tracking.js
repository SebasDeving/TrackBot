const { MessageEmbed } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const moment = require('moment');


const canal_recibir_pedidos = '1378900572182417418';
const canal_encamino = '1378892672558825494';
const canal_pendiente = '1379184470527049869';
const canal_entregado = '1378863113096396990';
const canal_disponible = '1378863085254610954';

async function obtenerEstadoEnvio(trackingNumber) {
  if (!trackingNumber || typeof trackingNumber !== 'string') {
    console.error('❌ Tracking number inválido');
    return 'Error de validación';
  }

  const url = `https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=${trackingNumber}`;
  let browser;
  let page;

  try {
    const fs = require('fs');
    const defaultPaths = [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
    ].filter(Boolean);

    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer'
      ],
      defaultViewport: { width: 1280, height: 720 }
    };

    // Buscar ejecutable de navegador
    for (const p of defaultPaths) {
      if (!p) continue;
      try {
        if (fs.existsSync(p)) {
          launchOptions.executablePath = p;
          console.log(`✅ Usando navegador: ${p}`);
          break;
        }
      } catch (e) {
        console.warn(`⚠️ No se pudo verificar la ruta: ${p}`);
      }
    }

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navegar con mejor manejo de errores
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });

    // Esperar el selector con reintentos
    await page.waitForSelector('span.correos-ui-tracking-stepper__title', { 
      timeout: 40000 
    });

    const estado = await page.evaluate(() => {
      const span = document.querySelector('span.correos-ui-tracking-stepper__title');
      return span?.textContent?.trim() || 'No encontrado';
    });

    console.log(`✅ Estado obtenido para ${trackingNumber}: ${estado}`);
    return estado;

  } catch (err) {
    console.error(`❌ Error obteniendo estado del tracking ${trackingNumber}:`, err.message);
    
    if (err.message.includes('timeout')) {
      return 'Error: Tiempo de espera agotado';
    } else if (err.message.includes('net::')) {
      return 'Error: Sin conexión';
    }
    
    return 'Error de conexión';
  } finally {
    try {
      if (page) await page.close();
      if (browser) await browser.close();
    } catch (closeErr) {
      console.error('⚠️ Error al cerrar el navegador:', closeErr.message);
    }
  }
}

async function guardarEnBaseDeDatos(client, { idenvio, tracking_number, estado, idmensaje_discord }) {
  try {
    if (!client?.db) {
      throw new Error('Cliente de base de datos no disponible');
    }
    
    if (!idenvio || !tracking_number || !estado || !idmensaje_discord) {
      throw new Error('Datos incompletos para guardar en BD');
    }

    const sql = `INSERT INTO envios_tracking (idenvio, tracking_number, estado, idmensaje_discord) VALUES (?, ?, ?, ?)`;
    const result = await client.db.query(sql, [idenvio, tracking_number, estado, idmensaje_discord]);
    console.log(`✅ Tracking ${tracking_number} guardado en BD`);
    return result;
  } catch (error) {
    console.error('❌ Error al guardar en BD:', error.message);
    throw error;
  }
}

async function trackingExiste(client, tracking_number) {
  try {
    if (!client?.db) {
      throw new Error('Cliente de base de datos no disponible');
    }
    
    if (!tracking_number) {
      return false;
    }

    const sql = `SELECT * FROM envios_tracking WHERE tracking_number = ? LIMIT 1`;
    const rows = await client.db.query(sql, [tracking_number]);
    return rows.length > 0;
  } catch (error) {
    console.error('❌ Error al verificar existencia de tracking:', error.message);
    return false;
  }
}

async function eliminarTracking(client, message, trackingNumber) {
  try {
    if (!trackingNumber) {
      return message.reply('⚠️ Número de tracking no proporcionado.');
    }

    if (!client?.db) {
      return message.reply('❌ Error: Base de datos no disponible.');
    }

    const sqlSelect = 'SELECT * FROM envios_tracking WHERE tracking_number = ? LIMIT 1';
    const rows = await client.db.query(sqlSelect, [trackingNumber]);

    if (rows.length === 0) {
      return message.reply(`⚠️ No se encontró ningún registro con el tracking \`${trackingNumber}\`.`);
    }

    const registro = rows[0];
    let mensajeEliminado = false;

    const canales = [
      canal_encamino,
      canal_pendiente,
      canal_entregado,
      canal_disponible,
      canal_recibir_pedidos
    ];

    // Intentar eliminar el mensaje de Discord
    for (const canalId of canales) {
      try {
        const canal = await client.channels.fetch(canalId);
        if (!canal) continue;
        
        const mensaje = await canal.messages.fetch(registro.idmensaje_discord).catch(() => null);
        if (mensaje) {
          await mensaje.delete();
          mensajeEliminado = true;
          console.log(`✅ Mensaje eliminado del canal ${canalId}`);
          break;
        }
      } catch (e) {
        console.warn(`⚠️ No se pudo eliminar mensaje del canal ${canalId}:`, e.message);
      }
    }

    // Eliminar de la base de datos
    const sqlDelete = 'DELETE FROM envios_tracking WHERE tracking_number = ?';
    await client.db.query(sqlDelete, [trackingNumber]);

    const respuesta = mensajeEliminado 
      ? `✅ El tracking \`${trackingNumber}\` y su mensaje fueron eliminados correctamente.`
      : `✅ El tracking \`${trackingNumber}\` fue eliminado de la base de datos (mensaje no encontrado en Discord).`;
    
    await message.reply(respuesta);
    console.log(`✅ Tracking ${trackingNumber} eliminado correctamente`);

  } catch (error) {
    console.error('❌ Error al eliminar el tracking:', error.message);
    return message.reply('❌ Hubo un error al intentar eliminar el tracking. Por favor, revisa los logs.');
  }
}

async function listarTrackings(client, message) {
  try {
    if (!client?.db) {
      return message.reply('❌ Error: Base de datos no disponible.');
    }

    const sql = 'SELECT tracking_number, estado FROM envios_tracking ORDER BY idenvio DESC';
    const rows = await client.db.query(sql);

    if (!rows || rows.length === 0) {
      return message.reply('📭 No hay ningún tracking registrado actualmente.');
    }

    const bloques = [];
    let bloque = '';
    const ITEMS_POR_PAGINA = 10;

    rows.forEach((r, i) => {
      if (!r.tracking_number || !r.estado) {
        console.warn(`⚠️ Registro incompleto en índice ${i}`);
        return;
      }
      
      bloque += `**${i + 1}.** \`${r.tracking_number}\` → **${r.estado}**\n`;
      
      if ((i + 1) % ITEMS_POR_PAGINA === 0 || i + 1 === rows.length) {
        bloques.push(bloque);
        bloque = '';
      }
    });

    if (bloque.trim()) {
      bloques.push(bloque);
    }

    for (let i = 0; i < bloques.length; i++) {
      try {
        const embed = new MessageEmbed()
          .setTitle('📋 Lista de Envíos Registrados')
          .setDescription(bloques[i] || 'Sin datos')
          .setColor('#00BFFF')
          .setFooter({ text: `Página ${i + 1}/${bloques.length} | Total: ${rows.length} envíos` })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        
        // Pequeña pausa entre mensajes para evitar rate limits
        if (i < bloques.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (sendError) {
        console.error(`❌ Error al enviar página ${i + 1}:`, sendError.message);
      }
    }

    console.log(`✅ Lista de ${rows.length} trackings enviada`);

  } catch (error) {
    console.error('❌ Error al listar trackings:', error.message);
    return message.reply('❌ Hubo un error al intentar obtener la lista de trackings. Por favor, revisa los logs.');
  }
}

// Mapeo de estados a canales
function obtenerCanalPorEstado(estado, canalPorDefecto) {
  const estadoUpper = estado.toUpperCase();
  
  if (estadoUpper.includes('ENTREGADO')) return canal_entregado;
  if (estadoUpper.includes('EN CAMINO')) return canal_encamino;
  if (estadoUpper.includes('PRE-ADMISIÓN') || estadoUpper.includes('PRE-ADMISION')) return canal_pendiente;
  if (estadoUpper.includes('EN ENTREGA')) return canal_disponible;
  
  return canalPorDefecto;
}

// Validar formato de tracking
function esTrackingValido(tracking) {
  if (!tracking || typeof tracking !== 'string') return false;
  // Acepta códigos alfanuméricos de al menos 10 caracteres
  return /^[A-Z0-9]{10,}$/.test(tracking);
}

module.exports = {
  name: 'messageCreate',
  run: async (client, message) => {
    try {
      // Validaciones iniciales
      if (!message || !message.author || !message.content) return;
      
      const allowedBotTag = 'gab#3397';
      if (message.author.bot && message.author.tag !== allowedBotTag) return;

      const contenido = message.content.trim();

      // Comando: !eliminar
      if (contenido.startsWith('!eliminar')) {
        const args = contenido.split(/\s+/);
        const trackingNumber = args[1]?.toUpperCase();
        
        if (!trackingNumber) {
          return message.reply('⚠️ Debes especificar el número de tracking.\nEjemplo: `!eliminar LB123456789ES`');
        }
        
        return eliminarTracking(client, message, trackingNumber);
      }

      // Comando: !list o !lista
      if (contenido.startsWith('!list') || contenido.startsWith('!lista')) {
        return listarTrackings(client, message);
      }

      // Solo procesar trackings en el canal designado
      if (message.channel.id !== canal_recibir_pedidos) return;

      const trackingNumber = contenido.toUpperCase();

      // Validar formato de tracking
      if (!esTrackingValido(trackingNumber)) {
        console.log(`⚠️ Formato de tracking inválido: ${contenido}`);
        return;
      }

      // Verificar si ya existe
      const yaExiste = await trackingExiste(client, trackingNumber);
      if (yaExiste) {
        const aviso = await message.reply(`⚠️ El tracking \`${trackingNumber}\` ya existe en el sistema.`);
        // Auto-eliminar mensaje de aviso después de 10 segundos
        setTimeout(() => aviso.delete().catch(() => {}), 10000);
        return message.delete().catch(() => {});
      }

      // Obtener estado del envío
      console.log(`🔍 Consultando tracking: ${trackingNumber}`);
      const estado = await obtenerEstadoEnvio(trackingNumber);

      // Verificar si hubo error al obtener el estado
      if (estado.includes('Error')) {
        const errorMsg = await message.reply(`❌ No se pudo obtener el estado del tracking \`${trackingNumber}\`. Estado: ${estado}`);
        setTimeout(() => errorMsg.delete().catch(() => {}), 15000);
        return message.delete().catch(() => {});
      }

      // Determinar canal destino según el estado
      const canalDestino = obtenerCanalPorEstado(estado, message.channel.id);

      // Crear embed con información del tracking
      moment.locale('es');
      const fechaMensaje = moment(message.createdAt).format('D/MM/YYYY h:mm a');

      const embed = new MessageEmbed()
        .setTitle('📦 Seguimiento de envío')
        .addFields(
          { name: '🔖 Tracking Number', value: `\`${trackingNumber}\``, inline: false },
          { name: '📍 Estado', value: estado, inline: true },
          { name: '📅 Fecha de Registro', value: fechaMensaje, inline: true }
        )
        .setColor('#FFD700')
        .setTimestamp()
        .setFooter({ text: 'Sistema de Tracking Automático' });

      // Enviar mensaje al canal correspondiente
      const canal = await client.channels.fetch(canalDestino);
      if (!canal) {
        throw new Error(`No se pudo obtener el canal ${canalDestino}`);
      }

      const mensajeBot = await canal.send({ embeds: [embed] });

      // Guardar en base de datos
      const idenvio = uuidv4();
      await guardarEnBaseDeDatos(client, {
        idenvio,
        tracking_number: trackingNumber,
        estado,
        idmensaje_discord: mensajeBot.id
      });

      // Eliminar mensaje original del usuario
      await message.delete().catch(err => {
        console.warn('⚠️ No se pudo eliminar el mensaje original:', err.message);
      });

      console.log(`✅ Tracking ${trackingNumber} procesado exitosamente`);

    } catch (error) {
      console.error('❌ Error crítico al procesar el tracking:', error.message);
      console.error('Stack:', error.stack);
      
      // Intentar notificar al usuario si es posible
      try {
        if (message && !message.deleted) {
          await message.reply('❌ Ocurrió un error al procesar el tracking. Por favor, contacta al administrador.');
        }
      } catch (replyError) {
        console.error('❌ No se pudo enviar mensaje de error al usuario:', replyError.message);
      }
    }
  }
};

