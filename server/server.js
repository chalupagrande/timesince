'use strict'

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const redis = require('redis');
const auth = require("./auth.js");
const app = express();

const client = redis.createClient(11497, "pub-redis-11497.dal-05.1.sl.garantiadata.com", {no_ready_check: true});

client.auth(auth.password, function(err){
  if(err){
    new Error(err)
  }
})

client.on("connect", function(){
  console.log("Connected to Redis")
})


const port = process.env.VCAP_APP_PORT || 3000;
const host = process.env.VCAP_APP_HOST || 'localhost';

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());

var storage = {}

//POST
app.post('/slack', (req, res, next)=>{
  var b = req.body
  if(b.token != "S83RYJu8eJcmqjxjEGFcbreJ"){
    res.send("You have the wrong credentials. ")
  }

  var text = b.text
  var command = text.split(' ')[0]
  var name = text.slice(command.length+1)
  var key = formatKey(name)

  if(command == 'set' && !storage[key]){
    storage[key] = {
                     name: name,
                     time: new Date()
                   }
    res.send(name + " has been created!")
  } else if( command == "set" && storage[key]){
    res.send(name +" alread exists!")
  } else if( command == "reset" && storage[key]){
    var time = findTime(storage[key].time)
    storage[key].time = new Date()
    res.send( name + " has been reset. It was at "+ time)
  } else if( command == "reset" && !storage[key]){
    res.send("There was no command found by the name: "+ name)
  } else if( command == "get" && storage[key]){
    var time = findTime(storage[key].time)
    res.send("Time Since "+ name +": "+ time)
  } else {
    res.send('Something went wrong')
  }
})

app.listen(port)
console.log('running on '+ port)



/* HELPERS
~~~~~~~~~~~~~~~~~~~ */
function findTime(date){
  var now = new Date()
  var diff = now - date

  return formatTime(diff)
}

function formatTime(milliseconds) {
   var s = Math.floor(milliseconds / 1000)
   var m=0, h=0, d=0;

   if(s / 60 >= 1){
     m = Math.floor(s / 60)
     s = s % 60
   }
   if(m / 60 >= 1){
     h = Math.floor(m / 60)
     m = m % 60
   }
   if(h / 24 >= 1){
     d = Math.floor(h/24)
     h = h % 24
   }


   var result = s + " seconds"
   if(m) result = `${m} minutes ${s} seconds`
   if(h) result = `${h} hours ${m} minutes ${s} seconds`
   if(d) result = `${d} days ${h} hours ${m} minutes ${s} seconds`
   return result
}

function formatObject(obj){
  var result = {}
  result.name = obj.name
  result.time = new Date()
  return result
}

function formatKey(string){
  var temp = string.toLowerCase()
  return temp.split(' ').join('-')
}