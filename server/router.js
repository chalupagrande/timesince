module.exports = function(res, client, opts){
  var text = opts.text,
      command = opts.command,
      name = opts.name,
      key = opts.key,
      admin = opts.isAdmin
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
      } 
      reply = reply.map(function(el){
        return unformatKey(el)
      })
      r.text = "*List of Timers:* \n" + reply.join('\n')
      res.send(r)
    })
  }
  /* HELP 
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#help'){
    r.text = "Using one of the following commands: \n \
              *#set timer_name:* This will create a new timer and start counting the time thats passed. \n \
              *#reset timer_name:* This will reset the time for the timer to 0. \n \
              *#get timer_name:* This will return the current time on the timer, but not reset it. \n \
              *#list:* This will list the names of the timers"
    res.send(r)
  }
  /* RESET
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#reset'){
    client.get(key, function(err, reply){
      if(err){
        r.response_type = "ephemeral"
        res.send(r)
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
          img_url: reply.data
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
      } else if(reply == 0){
        r.response_type = 'ephemeral'
        r.text = 'This Timer already exists!'
        res.send(r)
      } else {
        r.text = obj.name + " has been set!"
      }
      res.send(r)
    })


  }
  /* GET 
  ~~~~~~~~~~~~~~~~~~ */
  if(command == '#get'){
    client.get(key, function(err, reply){
      if(err){
        r.response_type = "ephemeral"
        res.send(r)
      }
      reply = JSON.parse(reply)
      r.text = `*${reply.name}* is currently at: \n ${findTime(reply.time)}`
      if(reply.data){
        r.attachments = [{
          fallback: "Couldn't find data! Sorry",
          color: 'good',
          pretext: 'This is the data that was attached to your Timer!',
          title: "This happened "+ findTime(replyTime)+ " ago",
          title_link: reply.data,
          img_url: reply.data
        }]
      }
      res.send(r)
    })
  }
}