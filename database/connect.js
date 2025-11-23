const mysql = require('mysql');
const { host, user, password, database } = require('../configs.js').configs;

let pool = null;

// Función para inicializar y devolver la conexión
function connectToDatabase() {
  if (!pool) {
    pool = mysql.createPool({
      connectionLimit: 10,
      host,
      user,
      password,
      database
    });

    console.log("✅ MySQL Pool creado exitosamente");
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
