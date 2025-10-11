// Read all POST requests from https://api.norb.space/update
// https://api.norb.space/update updates the api repo
// https://api.norb.space/update/[id] updates the api repo with the id, performing lookup in config.json

const express = require("express");
const app = express();
const port = 25820;

const createUpdateHandler = require("./endpoint/update.js");
app.use(express.json());

// Create specific handlers from factory function
const selfUpdateHandler = createUpdateHandler("@");
const projectUpdateHandler = createUpdateHandler(); // Will get ID from req.params.id

// - API Routes
app.post("/update", selfUpdateHandler);
app.post("/update/:id", projectUpdateHandler);

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).send("API Hub is running.");
});

app.listen(port, () => {
  console.log(`API Hub server is running on http://localhost:${port}`);
});