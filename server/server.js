'use strict'

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
    var command = text.split(' ')[0]
    var name = text.slice(command.length+1)
    var key = formatKey(name)

    client.get(key, function(err, reply){
      if(err){
        throw new Error(error)
        res.end("Something went wrong. Nothing was found with by that entry. Try #list to see all the watches.")
        return
      }

      res.send({
        response_type: "in_channel",
        text: handleReply(reply, command, name, key)
      })
    })
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

function formatKey(string){
  var temp = string.toLowerCase()
  return temp.split(' ').join('-')
}
function formatObj(name){
  return JSON.stringify({
                     name: name,
                     time: new Date()
                   })
}
function handleReply(existing, command, name, key){

  existing = JSON.parse(existing)

  //handle request
  if(command == '#set' && !existing){
    client.set(key, formatObj(name))
    return name + " has been created!"

  } else if( command == "#set" && existing){
    return name +" alread exists!"

  } else if( command == "#reset" && existing){
    var time = findTime(new Date(existing.time))
    client.set(key, formatObj(name))
    return  name + " has been reset. It was at "+ time

  } else if( command == "#reset" && !existing){
    return "There was no watch found by the name: "+ name

  } else if( command == "#get" && existing){
    var time = findTime(new Date(existing.time))
    return "Time Since "+ name +": "+ time

  } else if(command == "#get" && !existing){
    return "There was no watch found by that name"

  } else if(command == "#help"){
    return "Using one of the following commands: \n \
    #set watch_name: This will create a new watch and start counting the time thats passed. \n \
    #reset watch_name: This will reset the time for the watch to 0. \n \
    #get watch_name: This will returnt the current time on the watch, but not reset it."

  } else if(command.split('')[0] == "#"){
    return "That was not a valid command."

  } else if(command.split('')[0] !='#'){
    var time = findTime(new Date(existing.time))
    return "Time Since "+ name +": "+ time
  }
}


var router = function(existing, command, name, key){
  switch(command){
    case '!admin':
      return routes.admin()
      break;
    case '#set':
      break;
    case '#reset':
      break;
    case '#get':
      break;
    case '#help':
      return routes.help()
      break;
    default:
      if(command.split('')[0] != '#'){
        return routes.get()

      } if(command.split('')[0] == '#'){
        return routes.incorrect()
      }
      break;
  }
}

var routes = {
  admin: function(name){

  },
  incorrect: function(){
    return "That command or watch does not exist. Use #help for a list of commands"
  },
  help: function(){
    return "Using one of the following commands: \n \
          #set watch_name: This will create a new watch and start counting the time thats passed. \n \
          #reset watch_name: This will reset the time for the watch to 0. \n \
          #get watch_name: This will returnt the current time on the watch, but not reset it."
  },
  get: function(name){

  },
}