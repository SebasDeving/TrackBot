const mysql = require('mysql2');
const { host, user, password, database } = require('../configs.js').configs;

let pool = null;

// Función para inicializar y devolver la conexión
function connectToDatabase() {
  if (!pool) {
    pool = mysql.createPool({
      connectionLimit: 10,
      host: host === 'localhost' ? '127.0.0.1' : host, // Force IPv4
      user,
      password,
      database,
      connectTimeout: 10000,
      acquireTimeout: 10000,
      waitForConnections: true,
      queueLimit: 0
    });

    // Test connection
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("❌ Error al conectar con MySQL:", err.message);
        console.error("💡 Verifica que MySQL esté corriendo y las credenciales sean correctas");
      } else {
        console.log("✅ MySQL Pool creado y conectado exitosamente");
        connection.release();
      }
    });
  }

  // Función query con Promesas
  const query = (sql, values = []) => {
    return new Promise((resolve, reject) => {
      pool.query(sql, values, (error, results) => {
        if (error) {
          console.error("❌ Error en MySQL:", error);
          return reject(error);
        }
        resolve(results);
      });
    });
  };

  return { query, pool };
}

module.exports = connectToDatabase;
