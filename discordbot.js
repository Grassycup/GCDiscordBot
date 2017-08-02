#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('./app');
var debug = require('debug')('gcdiscordbot:server');
var http = require('http');
var path = require('path');

var dotenv = require('dotenv');
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  dotenv.config({path: '.env'});
} else {
  dotenv.config({path: '.env.example', silent: true});
}


/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}

// discord
const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {
  var channel = message.channel;
  if (message.content === 'ping') {
    //message.reply('pong');
    channel.sendMessage('pong');
  }

  if(message.content === 'join') {
    if (!message.guild) {
      return message.reply('no private service is available in your area at the moment. Please contact a service representative for more details.');
    }
    const voiceChannel = message.guild.channels.find("name", 'voicetest');
    //console.log(voiceChannel.id);
    if (!voiceChannel || voiceChannel.type !== 'voice') {
      return message.reply(`I couldn't find the channel ${channelName}. Can you spell?`);
    }
    voiceChannel.join()
      .then(conn => {
        console.log('joined channel');
        message.reply('ready!');
        // create our voice receiver
        const receiver = conn.createReceiver();

        conn.on('speaking', (user, speaking) => {
          if (speaking) {
            //channel.sendMessage(`I'm listening to ${user}`);
            // this creates a 16-bit signed PCM, stereo 48KHz PCM stream.
            const audioStream = receiver.createPCMStream(user);
            // create an output stream so we can dump our data in a file
            const outputStream = generateOutputFile(voiceChannel, user);
            console.log(user);
            // pipe our audio data into the file stream
            audioStream.pipe(outputStream);
            // outputStream.on('data', (chunk) => {
            //   console.log(chunk);
            // });
            // when the stream ends (the user stopped talking) tell the user
            audioStream.on('end', () => {
              convertAudio(outputStream.path, channel, user);

              //channel.sendMessage(`I'm no longer listening to ${user}`);
            });
          }
        });
      })
      .catch(console.log);
  }

});

const fs = require('fs');
// make a new stream for each time someone starts to talk
function generateOutputFile(channel, member) {
  // use IDs instead of username cause some people have stupid emojis in their name
  const fileName = `./recordings/${channel.id}-${member.id}-${Date.now()}.pcm`;
  return fs.createWriteStream(fileName);
}

const { exec } = require('child_process');
// convert audio files to flac audio 16khz sample rate 16bit mono channel
function convertAudio(input, channel, user) {
  exec('ffmpeg -f s32le -i ' + input + ' -sample_fmt s16 -ar 16k -ac 1 -c:a flac ' + input + '.flac', (err, stdout, stderr) => {
    if (err) {
      // node couldn't execute the command
      return;
    }
    outputText(input, channel, user);

    // // the *entire* stdout and stderr (buffered)
    // console.log(`stdout: ${stdout}`);
    // console.log(`stderr: ${stderr}`);
  });
}

function outputText(p, channel, user) {
  console.log(path);
  var fileName = path.basename(p);
  exec('cd /mnt/g/trash/neon/neon && . .venv3/bin/activate && cd ./deepspeech/speech && echo "/mnt/c/Users/Cardinality/Documents/GitHub/GCDiscordBot/recordings/' + fileName +'.flac,helloworld.txt" > /mnt/g/trash/neon/neon/deepspeech/speech/csv/' + fileName + '.csv && python evaluate.py --manifest val:./csv/' + fileName + '.csv --model_file librispeech_16_epochs.prm -b cpu && deactivate', (err, stdout, stderr) => {
    if (err) {
      // node couldn't execute the command
      console.log(err);
      return;
    }
    // clean up files after done
    fs.unlink('/mnt/g/trash/neon/neon/deepspeech/speech/csv/' + fileName + '.csv', function() { console.log('csv removed'); });
    fs.unlink('/mnt/c/Users/Cardinality/Documents/GitHub/GCDiscordBot/recordings/' + fileName, function() { console.log('pcm removed'); });
    fs.unlink('/mnt/c/Users/Cardinality/Documents/GitHub/GCDiscordBot/recordings/' + fileName + '.flac', function() { console.log('flac removed'); });

    // // the *entire* stdout and stderr (buffered)
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
    channel.sendMessage(user + ' said ' + stdout);
    return stdout;
  });
}

client.login(process.env.DiscordToken);