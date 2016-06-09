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

  var r = {
    response_type: 'in_channel',
    text: 'There was a server error'
  }
  if(command == '#admin' || command == '#list' || command == '#help' ){
    r.response_type = 'ephemeral'
  }

  /* LIST 
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#list'){
    client.keys('*', function(err, reply){
      if(err){
        r.response_type = "ephemeral"
        res.send(r)
        return
      } 
      reply = reply.map(function(el){
        return unformatKey(el)
      })
      r.text = "*List of Timers:* \n" + reply.join('\n')
      res.send(r)
      return
    })
  }
  /* HELP 
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#help'){
    r.text = "Using one of the following commands: \n \
              *#set timer_name*: This will create a new timer and start counting the time thats passed. \n \
              *#reset timer_name*: This will reset the time for the timer to 0. \n \
              *#get timer_name*: This will return the current time on the timer, but not reset it. \n \
              *#list*: This will list the names of the timers \n \
              *#longest* or *#shortest* This will give you the shortest and longest times the Timer has seen. \n\
              *$data=*  Use this when you would like to add data to the Timer. (during a #set or #reset command)" 
    res.send(r)
    return
  }
  /* RESET
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#reset'){
    client.get(key, function(err, reply){
      if(err || !reply){
        r.response_type = "ephemeral"
        r.text = err || "We did not find a Timer by that name"
        res.send(r)
        return
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
      if(tempTime < reply.shortest){
        reply.shortest = difference
        isShortest = true
      }

      //set reply text
      var readableTime = findTime(tempTime)
      r.text = "*"+ reply.name +"* has been reset. \n \
      It was at: "+ readableTime

      if(isLongest){
        r.text += "\n This is your *longest* time."
      } else if (isShortest){
        r.text += "\n This is your *shortest* time."
      }

      //add attachments 
      if(reply.data){
        r.attachments= [{
          fallback: "Couldn't find data! Sorry",
          color: 'good',
          pretext: 'This is the data that was attached to your Timer!',
          title: "Click here to see the data!",
          title_link: reply.data,
          image_url: reply.data
        }]
      }

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
        r.response_type = 'ephemeral'
        res.send(r)
        return
      } else if(reply == 0){
        r.response_type = 'ephemeral'
        r.text = 'This Timer already exists!'
        res.send(r)
        return

      } else {
        r.text = `*${name.toUpperCase()}* has been set!`
      }
      res.send(r)
      return
    })

  }
  /* GET 
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#get'){
    client.get(key, function(err, reply){
      debugger;
      if(err || !reply){
        r.response_type = "ephemeral"
        r.text = err || "We did not find a Timer by that name."
        res.send(r)
        return
      }
      reply = JSON.parse(reply)
      reply.time = new Date(reply.time)
      r.text = `*${reply.name}* is currently at: \n ${findTime(reply.time)}`
      if(reply.data){
        r.attachments = [{
          fallback: "Couldn't find data! Sorry",
          color: 'good',
          pretext: 'This is the data that was attached to your Timer!',
          title: "This happened "+ findTime(reply.time)+ " ago",
          title_link: reply.data,
          image_url: reply.data
        }]
      }
      res.send(r)
      return
    })
  }

  if(command == '#longest' || command == '#shortest'){
    client.get(key, function(err, reply){
      if(err || !reply){
        r.response_type = "ephemeral"
        r.text = err || "We did not find a Timer by that name."
        res.send(r)
        return
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

      
      var longText = isLongest ? formatTime(new Date(difference)) : formatTime(new Date(reply.longest))
      var shortText = isShortest ? formatTime(new Date(difference)) : formatTime(new Date(reply.shortest)) 

      r.text = `*Longest* and *Shortest* times for ${reply.name} are:
                *Longest:* ${longText}
                *Shortest:* ${shortText}`
      res.send(r)
      return
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