// server.js (Express server for handling API endpoints)
const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// File upload setup
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// Upload document endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ message: "File uploaded successfully", filename: req.file.originalname });
});

// Generate document endpoint
app.post("/generate", (req, res) => {
  const { query, selectedDocs } = req.body;
  res.json({ generatedDocument: `Generated content based on query: ${query}` });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});