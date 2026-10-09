const express = require('express');
const app = express();

app.get('/user', (req, res) => {
  const query = "SELECT * FROM users WHERE id = " + req.query.id;
  res.send(query);
});