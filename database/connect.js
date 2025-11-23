const mysql = require('mysql');
const { host, user, password, database } = require('../configs.js').configs;

const connectToDatabase = () => {
  const connection = mysql.createConnection({
    host: host,
    user: user,
    password: password,
    database: database
  });

  const connect = () => {
    return new Promise((resolve, reject) => {
      connection.connect((error) => {
        if (error) {
          console.error("[ERROR] ".cyan + `${error}`.red);
          reject(error);
        } else {
          console.log("[MySQL] ".white + "Funcionando...".green);
          resolve();
        }
      });
    });
  };

  const closeConnection = () => {
    return new Promise((resolve, reject) => {
      connection.end((error) => {
        if (error) {
          console.error("[ERROR] ".cyan + `${error}`.red);
          reject(error);
        } else {
          console.log("[MySQL] ".white + "Conexión cerrada.".yellow);
          resolve();
        }
      });
    });
  };

  // Retorna la conexión, la función para conectar y la función para cerrar
  return {
    connection,
    connect
  };
};

module.exports = connectToDatabase;
