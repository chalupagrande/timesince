// const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();


const port = process.env.VCAP_APP_PORT || 3000;
const host = process.env.VCAP_APP_HOST || 'localhost';

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());

//POST
app.post('/', (req, res, next)=>{
  console.log('body '+ JSON.stringify(req.body))
  res.send(req.body)
})

//GET
app.get('/', (req, res, next)=>{
  res.send('hello world')
})

app.listen(port)
console.log('running on '+ port)

// const httpServer = http.createServer(app).listen(port)