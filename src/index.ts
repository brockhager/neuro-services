import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Hello from Neuro Services!");
});

app.listen(port, () => {
  console.log(`Neuro Services listening on port ${port}`);
});
