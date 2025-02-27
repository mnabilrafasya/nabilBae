const database = require("./database.js");
const express = require("express");
const path = require("path");
const session = require("express-session"); // Import express-session

const app = express();

// Setup express-session
app.use(
  session({
    secret: "your-secret-key", // Secret key for signing the session ID
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set 'secure: true' for HTTPS in production
  })
);

// Middleware untuk parsing body request
app.use(express.json()); // Untuk parsing JSON
app.use(express.urlencoded({ extended: true })); // Untuk parsing URL-encoded data

// Set EJS as the view engine
app.set("view engine", "ejs");
app.use(express.static("public"));

// Route untuk halaman utama
app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "public", "home.html")); // Mengirim file home.html
});

// Route untuk halaman login
app.get("/adminLogin", (req, res) => {
  res.render("adminLogin"); // Render login page
});

// Route untuk menangani login
app.post("/adminLogin", function (req, res) {
  const { username, password } = req.body;

  // Only allow admin to login
  if (username === "admin" && password === "12345") {
    req.session.user = { username, role: "admin" }; // Save the user in session as admin
    res.redirect("/index"); // Redirect to the admin dashboard
  } else {
    res.send("Invalid login credentials");
  }
});

// Middleware untuk melindungi halaman index agar hanya admin yang bisa akses
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") {
    return next(); // Allow access to the page if the user is an admin
  } else {
    res.redirect("/"); // Redirect to home if not an admin
  }
}

// Route untuk halaman admin (index)
app.get("/index", isAdmin, (req, res) => {
  const sql = `
    SELECT resep.*, kategori.nama_kategori 
    FROM resep 
    LEFT JOIN kategori ON resep.id_kategori = kategori.id;
  `;
  database.query(sql, (errorResep, resultsResep) => {
    if (errorResep) throw errorResep;
    const sqlKategori = "SELECT * FROM kategori";
    database.query(sqlKategori, (errorKategori, resultsKategori) => {
      if (errorKategori) throw errorKategori;
      res.render("index", {
        resep: resultsResep,
        kategori: resultsKategori,
      });
    });
  });
});

// Route untuk menambahkan resep
app.post("/add", function (req, res) {
  const { nama, id_kategori, bahan, gambar, deskripsi_makanan } = req.body;

  const sql = `
    INSERT INTO resep (id_kategori, nama, bahan, gambar, deskripsi_makanan) 
    VALUES (?, ?, ?, ?, ?)
  `;
  const values = [id_kategori, nama, bahan, gambar, deskripsi_makanan];

  database.query(sql, values, function (error, results) {
    if (error) {
      console.error(error);
      return res.status(500).send("Error inserting data");
    }
    res.redirect("/index"); // Redirect ke halaman index setelah berhasil menambah
  });
});

// Route untuk menyimpan langkah langkah
app.post("/add-langkah", function (req, res) {
  const { id_resep, deskripsi } = req.body;

  // Simpan deskripsi lengkap sebagai string, dipisahkan oleh "/"
  const sql = "INSERT INTO langkah (id_resep, deskripsi) VALUES (?, ?)";
  const values = [id_resep, deskripsi]; // deskripsi tetap menjadi satu string

  database.query(sql, values, function (error) {
    if (error) {
      console.error(error);
      return res.status(500).send("Error inserting steps");
    }
    res.redirect("/index"); // Redirect ke halaman index setelah menambah langkah
  });
});

app.get("/resep/:id", function (req, res) {
  const resepId = req.params.id;

  const sqlResep = `
        SELECT resep.*, kategori.nama_kategori 
        FROM resep 
        LEFT JOIN kategori ON resep.id_kategori = kategori.id 
        WHERE resep.id = ?
    `;
  const sqlLangkah = "SELECT * FROM langkah WHERE id_resep = ?";
  const sqlRandomResep = `
        SELECT resep.*, kategori.nama_kategori 
        FROM resep 
        LEFT JOIN kategori ON resep.id_kategori = kategori.id 
        ORDER BY RAND() 
        LIMIT 3
    `;

  database.query(sqlResep, [resepId], function (errorResep, resultsResep) {
    if (errorResep) throw errorResep;

    // Cek apakah resep ada
    if (resultsResep.length === 0) {
      return res.status(404).send("Recipe not found");
    }

    let resep = resultsResep[0];

    // mengubah bahan menjadi array yang dipisahkan menggunakan koma
    if (typeof resep.bahan === "string") {
      resep.bahan = resep.bahan.split(",").map((bahan) => bahan.trim());
    } else {
      resep.bahan = [];
    }

    database.query(
      sqlLangkah,
      [resepId],
      function (errorLangkah, resultsLangkah) {
        if (errorLangkah) throw errorLangkah;

        // Ambil deskripsi langkah sebagai string
        let langkah = [];
        if (
          resultsLangkah.length > 0 &&
          typeof resultsLangkah[0].deskripsi === "string"
        ) {
          langkah = resultsLangkah[0].deskripsi
            .split("/")
            .map((item) => item.trim());
        }

        database.query(sqlRandomResep, function (errorRandom, resultsRandom) {
          if (errorRandom) throw errorRandom;

          // Kirim data ke ejs
          res.render("detail", {
            resep: resultsResep,
            langkah: langkah, // Berupa array langkah
            kategori: resep.nama_kategori, // Pass the category to EJS
            randomResep: resultsRandom, // Pass the random recipes to EJS
          });
        });
      }
    );
  });
});

// Resep Sayuran
app.get("/sayuran", function (req, res) {
  const sql = `
    SELECT resep.id, resep.nama, resep.bahan, resep.gambar, resep.deskripsi_makanan
    FROM resep
    JOIN kategori ON resep.id_kategori = kategori.id
    WHERE kategori.nama_kategori = 'Sayuran'
  `;

  database.query(sql, function (error, results) {
    if (error) throw error;
    res.render("sayuran", { resep: results });
  });
});

// Resep Daging
app.get("/daging", function (req, res) {
  const sql = `
    SELECT resep.id, resep.nama, resep.bahan, resep.gambar, resep.deskripsi_makanan
    FROM resep
    JOIN kategori ON resep.id_kategori = kategori.id
    WHERE kategori.nama_kategori = 'Daging'
  `;

  database.query(sql, function (error, results) {
    if (error) throw error;
    res.render("daging", { resep: results });
  });
});

// Resep Ayam
app.get("/ayam", function (req, res) {
  const sql = `
    SELECT resep.id, resep.nama, resep.bahan, resep.gambar, resep.deskripsi_makanan
    FROM resep
    JOIN kategori ON resep.id_kategori = kategori.id
    WHERE kategori.nama_kategori = 'Ayam'
  `;

  database.query(sql, function (error, results) {
    if (error) throw error;
    res.render("ayam", { resep: results });
  });
});

// Resep Seafood
app.get("/seafood", function (req, res) {
  const sql = `
    SELECT resep.id, resep.nama, resep.bahan, resep.gambar, resep.deskripsi_makanan
    FROM resep
    JOIN kategori ON resep.id_kategori = kategori.id
    WHERE kategori.nama_kategori = 'Seafood'
  `;

  database.query(sql, function (error, results) {
    if (error) throw error;
    res.render("seafood", { resep: results });
  });
});

// Resep Tradisional
app.get("/tradisional", function (req, res) {
  const sql = `
    SELECT resep.id, resep.nama, resep.bahan, resep.gambar, resep.deskripsi_makanan
    FROM resep
    JOIN kategori ON resep.id_kategori = kategori.id
    WHERE kategori.nama_kategori = 'Tradisional'
  `;

  database.query(sql, function (error, results) {
    if (error) throw error;
    res.render("tradisional", { resep: results });
  });
});

// Resep Sambal
app.get("/sambal", function (req, res) {
  const sql = `
    SELECT resep.id, resep.nama, resep.bahan, resep.gambar, resep.deskripsi_makanan
    FROM resep
    JOIN kategori ON resep.id_kategori = kategori.id
    WHERE kategori.nama_kategori = 'Sambal'
  `;

  database.query(sql, function (error, results) {
    if (error) throw error;
    res.render("sambal", { resep: results });
  });
});

// Route untuk menghapus resep
app.post("/delete", function (req, res) {
  const { id } = req.body;

  const sql = "DELETE FROM resep WHERE id = ?";
  database.query(sql, [id], function (error) {
    if (error) {
      console.error(error);
      return res.status(500).send("Error deleting data");
    }
    res.redirect("/index"); // Redirect ke halaman index setelah menghapus
  });
});

// route edit resep
app.get("/resep/edit/:id", (req, res) => {
  const id = req.params.id;
  const sql = `
        SELECT resep.*, kategori.nama_kategori 
        FROM resep 
        LEFT JOIN kategori ON resep.id_kategori = kategori.id 
        WHERE resep.id = ?
    `;
  const sqlKategori = "SELECT * FROM kategori";

  database.query(sql, [id], (errorResep, resultsResep) => {
    if (errorResep) throw errorResep;
    if (resultsResep.length === 0)
      return res.status(404).send("Resep tidak ditemukan.");

    database.query(sqlKategori, (errorKategori, resultsKategori) => {
      if (errorKategori) throw errorKategori;
      res.render("edit", {
        resep: resultsResep[0], // Data resep
        kategori: resultsKategori, // Data kategori
      });
    });
  });
});

// Route untuk mengupdate resep
app.post("/resep/edit/:id", (req, res) => {
  const id = req.params.id;
  const { nama, id_kategori, bahan, gambar, deskripsi_makanan } = req.body;

  const sql = `
        UPDATE resep 
        SET nama = ?, id_kategori = ?, bahan = ?, gambar = ?, deskripsi_makanan = ? 
        WHERE id = ?
    `;
  const values = [nama, id_kategori, bahan, gambar, deskripsi_makanan, id];

  database.query(sql, values, (error) => {
    if (error) throw error;
    res.redirect("/index"); // Kembali ke halaman index setelah menyimpan perubahan
  });
});

// Route untuk pencarian resep berdasarkan nama
app.get("/search", (req, res) => {
  const searchQuery = req.query.query; // Ambil query pencarian dari input form

  if (!searchQuery) {
    return res.render("search", { searchQuery: "", results: [] });
  }

  const sql = `
    SELECT id, nama, gambar 
    FROM resep 
    WHERE nama LIKE ?
  `;

  const searchValue = `%${searchQuery}%`; // Gunakan wildcard untuk pencarian LIKE

  database.query(sql, [searchValue], (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).send("Error during search");
    }

    // Render hasil pencarian ke template EJS
    res.render("search", { searchQuery, results });
  });
});

// Jalankan server
const PORT = 3000;
app.listen(PORT, function () {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
