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
  console.log(b)
  if((b["user_name"] == 'j.skinner' && b.token == "VD5a2oMjTKS5vwNKrjfkdIm6") || 
      b.token == "VD5a2oMjTKS5vwNKrjfkdIm6" && b.channel_id == "G0U83AL2E"){
    var text = b.text
    var admin = !!text.match(/\!\!| \!\!|\!\! /g)
    var expression = new RegExp(/\$data\=(.*)/).exec(text)
    var data = expression ? expression[1] : null;
    if(expression){ text = text.replace(expression[0],'') }
    text = text.replace(/\!\!| \!\!|\!\! /g, '')
    text = text.trim()
    var command = text.match(/\#set|\#get|\#reset|\#help|\#list|\#longest|\#shortest/g)
    command = !!command ? command[0] : "#get"
    var name = text.replace(new RegExp(command+' '), '')
    var key = formatKey(name.trim())

    var response = router(res, client, {text, command, name, key, admin, data})
  } else {
    res.end("You have the wrong credentials. Contact @j.skinner to get credentials.")
  }
})
app.get('/', (req, res, next)=>{
  res.send("Hello World. From Time Since")
})

app.listen(port)
console.log('running on '+ port)


/* 
~~~~~~~~~~~~~~~~~~~~~~~ 
ROUTER 
~~~~~~~~~~~~~~~~~~~~~~~
*/
function router(res, client, opts){
  var text = opts.text,
      command = opts.command,
      name = opts.name,
      key = opts.key,
      admin = opts.isAdmin,
      data = opts.data;
  
  console.log(`TEXT: ${text},\n COMMAND: ${command}, \n DATA: ${data} \n NAME: ${name}`)

  /* LIST 
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#list'){
    client.keys('*', function(err, reply){
      if(err || reply.length == 0){
        return res.send(formatResponse({
          channel: false,
          text: "There were no Timers found. Create one using #set"
        }))
      } 
      reply = reply.map(function(el,i){
        return i+1 +')'+ unformatKey(el)
      })
      var num = 1
      return res.send(formatResponse({
        channel: false, 
        name: "List of Commands:",
        text: reply.join('\n')
      }))

    })
  }
  /* HELP 
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#help'){
    var r = formatResponse({
    name: "Using one of the following commands:",
    text: "#set timer_name: Creates a new timer \n #reset timer_name: Resets the time for the timer to 0. \n #get timer_name: Returns the current time on the timer. Doesn't reset. \n #list: Lists the names of timers. \n #longest or #shortest Lists Longest and Shortest times on Timer \n $data= Use to set data. (during a #set or #reset command)" 
    })
    res.send(r)
    return
  }
  /* RESET
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#reset'){
    client.get(key, function(err, reply){
      if(err || !reply){
        var r = formatResponse({channel: false})
        return res.send(r)
        
      } 
      reply = JSON.parse(reply)
      var now = new Date()
      //check if its the longest or shortest
      var tempTime = new Date(reply.time)
      var difference = now - tempTime
      var isLongest, isShortest;
      if(difference > reply.longest){
        reply.longest = difference
        isLongest = true
      } 
      if(tempTime < reply.shortest || !reply.shortest){
        reply.shortest = difference
        isShortest = true
      }

      //set reply text
      var readableTime = findTime(tempTime)
      var r = formatResponse({
        pretext: `${reply.name} has been reset! Here was the last one:`,
        channel: !admin,
        name: reply.name,
        text: readableTime,
        data: reply.data,
        footer: (()=>{
          return `Longest: ${formatTime(reply.longest)} \n Shortest: ${formatTime(reply.shortest)}`
        })()
      })

      //reset reply time + attachment
      reply.time = new Date()
      reply.data = data
      client.set(key, JSON.stringify(reply), function(err, reply){
        if(err){
          console.log(err)
          throw new Error(err)
        }
      })
      res.send(r)
      return
    })
  }
  /* SET 
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#set'){
    var obj = {
      name: name.toUpperCase(),
      time: new Date(),
      longest: 0,
      shortest: Infinity,
      data: data
    }
    obj = JSON.stringify(obj)
    client.setnx(key, obj, function(err, reply){
      if(err){
        return formatResponse({channel: false})
      } else if(reply == 0){
        return res.send(formatResponse({
          channel: false,
          name: "OOPS!",
          text:`It looks like ${name.toUpperCase()} already exists!`
        }))
      } else {
        return res.send(formatResponse({
          channel: !admin,
          name: name.toUpperCase(),
          text: `${name.toUpperCase()} has been set!`
        }))
      }
    })

  }
  /* GET 
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#get'){
    client.get(key, function(err, reply){
      if(err || !reply){
        return res.send(formatResponse({channel: false}))
      }
      reply = JSON.parse(reply)
      reply.time = new Date(reply.time)
      return res.send(formatResponse({
        channel: !admin,
        name: reply.name,
        data: reply.data,
        text: findTime(reply.time),
        footer: (()=>{
          return `Longest: ${formatTime(reply.longest)} \n Shortest: ${formatTime(reply.shortest)}`
        })()
      }))
    })
  }

  if(command == '#longest' || command == '#shortest'){
    client.get(key, function(err, reply){
      if(err || !reply){
        return res.send(formatResponse({channel: false}))
      }
      reply = JSON.parse(reply)
      reply.time = new Date(reply.time)
      var now = new Date()
      var difference = now - reply.time 
      var isLongest, isShortest;
      if(difference > reply.longest){
        reply.longest = difference
        isLongest = true
      } else if (difference < reply.shortest){
        reply.shortest = difference
        isShortest = true
      }

      return res.send(formatResponse({
        channel: !admin,
        name: reply.name,
        data: reply.data,
        footer: `Current Time: ${findTime(reply.time)}`,
        text: (()=>{
          return `Longest: ${formatTime(reply.longest)} \n Shortest: ${formatTime(reply.shortest)}`
        })()
      }))
    })
  }
}



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
  return key.replace(/\-/g, ' ').toUpperCase()
}

function formatObj(name){
  return JSON.stringify({
                     name: name,
                     time: new Date(),
                     longest: 0,
                     shortest: Infinity,
                     data: null
                   })
}
// args = {channel, name, text, pretext, data, footer}
function formatResponse(args){
  var obj = {
            "fallback": "Couldn't find data! Sorry",
            "color": args.channel ? "good" : "#333333",
            "author_name": "Time Since:",
            "title": args.name || "Sorry!",
            "text": args.text || "Something went wrong",
  }
  if(args.pretext) obj.pretext = args.pretext
  if(args.data) obj["image_url"] = args.data
  if(args.footer) obj.footer = args.footer
  
  return {
                response_type: args.channel ? "in_channel" : "ephemeral",
                attachments:[obj]
              }
}