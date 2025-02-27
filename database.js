const mysql = require("mysql");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "resepqu",
});
db.connect(function (error) {
  if (error) throw error;
  console.log("Koneksi ke database berhasil!");
});

module.exports = db;
