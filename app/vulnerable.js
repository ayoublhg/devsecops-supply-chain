const express = require('express');
const app = express();
const mysql = require('mysql');

app.get('/user', (req, res) => {
  const connection = mysql.createConnection({ host: 'localhost' });
  const query = "SELECT * FROM users WHERE id = " + req.query.id;
  connection.query(query, (error, results) => {
    res.json(results);
  });
});
