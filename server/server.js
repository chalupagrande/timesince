'use strict';

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const redis = require('redis');
const auth = require("./auth.js");
const app = express();


// Connect to REDIS Database
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


//POST
app.post('/slack', (req, res, next)=>{
  var b = req.body
  if(b.token != "VD5a2oMjTKS5vwNKrjfkdIm6" || b.channel_id != "G0U83AL2E"){
    res.end("You have the wrong credentials. Contact @j.skinner to get credentials.")
  } else {
    var text = b.text
    var admin = !!text.match(/\!\!| \!\!|\!\! /g)
    var text = text.replace(/\!\!| \!\!|\!\! /g, '')
    var command = text.match(/\#set|\#get|\#reset|\#help|\#list/g)
    command = !!command ? command[0] : "#get"
    var name = text.replace(new RegExp(command+' '), '')
    var key = formatKey(name)

    var response = router({res, text, command, name, key, admin})
  }
})
app.get('/', (req, res, next)=>{
  res.send("Hello World. From Time Since")
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

function formatKey(string){
  var temp = string.toLowerCase()
  return temp.split(' ').join('-')
}

function unformatKey(key){
  return key.replace(/\-/g, ' ')
}

function formatObj(name){
  return JSON.stringify({
                     name: name,
                     time: new Date()
                   })
}

var router = function(opts){
  let res = opts.res,
      text = opts.text,
      command = opts.command,
      name = opts.name,
      key = opts.key,
      admin = opts.isAdmin;


  let r = {
    "response_type": "in_channel"
  };

  if(admin){
      result.response_type = "ephemeral"
  }

  if(command == '#list'){
    client.keys('*', function(err, reply){
      if(err){
        throw new Error(err)
        res.send(routes.error())
      }
      else {
        console.log(Array.isArray(reply))
        reply = reply.map((el)=>{
          return unformatKey(el)
        })
        r.response_type = "ephemeral"
        r.text = "*List of Timers:* \n" + reply.join('\n')
        res.send(r)
      }
    })
  }

  else if(command == '#set'){
    console.log('set')
    client.setnx(key, formatObj(name), function(err,reply){
      if(err){
        throw new Error(err)
        res.send(routes.error())
      }
      else if(reply == 0){ res.send(routes.incorrect()) }
      else {
        r.text = routes.set(name, key)
        res.send(r)
      }
    })
  }

  else if(command == '#reset'){
    console.log('reset')
    client.getset(key, formatObj(name), function(err,reply){
      if(err){
        throw new Error(err)
        res.send(routes.incorrect())
      }
      else {
        r.text = routes.reset(name, key, reply)
        res.send(r)
      }
    })
  }

  else if(command == '#get'){
    client.get(key, function(err,reply){
      if(err){
        throw new Error(err)
        res.send(routes.incorrect())
      }
      else {
        r.text = routes.get(name, key, reply)
        res.send(r)
      }
    })
  }

  else if(command == '#help'){
    res.send(routes.help())
  }
}

var routes = {
  admin: function(name){
    return "This is admin mode"

  },
  incorrect: function(){
    return {
      response_type: 'ephemeral',
      text: "That command or timer does not exist or already exists. Use #help for a list of commands"
    }
  },
  help: function(){
    return {
      response_type: 'ephemeral',
      text:   "Using one of the following commands: \n \
              *#set timer_name:* This will create a new timer and start counting the time thats passed. \n \
              *#reset timer_name:* This will reset the time for the timer to 0. \n \
              *#get timer_name:* This will return the current time on the timer, but not reset it. \n \
              *#list:* This will list the names of the timers"
    }
  },
  get: function(name, key, reply){
    console.log('get '+ name + ' ' + key)
    reply = JSON.parse(reply)
    var time = findTime(new Date(reply.time))
    return "*Time Since "+ reply.name +":* "+ time
  },
  set: function(name, key){
    return "*"+name+"* has been set!"
  },
  error: function(){
    return {
      response_type: "ephemeral",
      text: "There seems to have been a server error"
    }
  },
  reset: function(name, key, reply){
    console.log('reset')
    reply = JSON.parse(reply)
    var time = findTime(new Date(reply.time))
    return "*"+name +":* has been reset. It was last at: "+ time
  }

}