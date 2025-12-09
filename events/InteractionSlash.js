const { MessageEmbed } = require('discord.js');

/**
 * Maneja de forma segura la respuesta de errores a las interacciones
 * @param {Interaction} interaction - La interacción de Discord
 * @param {string} mensaje - Mensaje de error a enviar
 */
async function manejarErrorInteraccion(interaction, mensaje) {
  try {
    if (!interaction) {
      console.error('❌ Interacción no definida');
      return;
    }

    // Verificar si la interacción ya expiró (más de 15 minutos)
    const tiempoTranscurrido = Date.now() - interaction.createdTimestamp;
    if (tiempoTranscurrido > 15 * 60 * 1000) {
      console.warn('⚠️ La interacción ha expirado, no se puede responder');
      return;
    }

    // Intentar responder o hacer followUp según el estado
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: mensaje,
        ephemeral: true
      });
    } else if (interaction.deferred) {
      await interaction.editReply({
        content: mensaje
      });
    } else {
      // Si ya se respondió, intentar followUp
      await interaction.followUp({
        content: mensaje,
        ephemeral: true
      }).catch(err => {
        console.error('⚠️ No se pudo enviar followUp:', err.message);
      });
    }
  } catch (err) {
    console.error('❌ Error al manejar error de interacción:', err.message);
  }
}

module.exports = {
  name: 'interactionCreate',
  run: async (client, interaction) => {
    try {
      // Validaciones iniciales
      if (!interaction) {
        console.error('❌ Interacción no definida');
        return;
      }

      // Solo procesar comandos slash
      if (!interaction.isCommand()) return;

      // Validar que exista el comando
      if (!interaction.commandName) {
        console.warn('⚠️ Nombre de comando no definido');
        return;
      }

      // Verificar que el cliente tenga slashCommands
      if (!client || !client.slashCommands) {
        console.error('❌ Cliente o colección de slashCommands no disponible');
        await manejarErrorInteraccion(
          interaction,
          '❌ Error del sistema: comandos no disponibles.'
        );
        return;
      }

      const slashCmd = client.slashCommands.get(interaction.commandName);
      
      if (!slashCmd) {
        console.warn(`⚠️ Comando slash '${interaction.commandName}' no encontrado`);
        await manejarErrorInteraccion(
          interaction,
          `⚠️ El comando \`/${interaction.commandName}\` no está disponible.`
        );
        return;
      }

      // Validar que el comando tenga la función run
      if (typeof slashCmd.run !== 'function') {
        console.error(`❌ El comando '${interaction.commandName}' no tiene función run`);
        await manejarErrorInteraccion(
          interaction,
          '❌ Error del sistema: comando mal configurado.'
        );
        return;
      }

      // Log de ejecución
      console.log(
        `🔵 Ejecutando /${interaction.commandName} | Usuario: ${interaction.user.tag} | Guild: ${interaction.guild?.name || 'DM'}`
      );

      // Ejecutar el comando
      try {
        await slashCmd.run(interaction);
        console.log(`✅ Comando /${interaction.commandName} ejecutado exitosamente`);
      } catch (cmdError) {
        console.error(`❌ Error ejecutando slash command '${interaction.commandName}':`, {
          error: cmdError.message,
          stack: cmdError.stack,
          usuario: interaction.user.tag,
          guild: interaction.guild?.name
        });

        await manejarErrorInteraccion(
          interaction,
          '⚠️ Ocurrió un error al ejecutar este comando. Por favor, intenta nuevamente.'
        );
      }

    } catch (error) {
      console.error("❌ Error crítico en evento interactionCreate:", {
        error: error.message,
        stack: error.stack,
        comando: interaction?.commandName,
        usuario: interaction?.user?.tag
      });

      // Intentar notificar al usuario del error
      try {
        await manejarErrorInteraccion(
          interaction,
          '❌ Ha ocurrido un error crítico al procesar tu interacción. Por favor, contacta al administrador.'
        );
      } catch (finalError) {
        console.error('❌ No se pudo notificar el error al usuario:', finalError.message);
      }
    }
  },
};
