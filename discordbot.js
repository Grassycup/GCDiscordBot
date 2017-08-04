#!/usr/bin/env node

/**
 * Module dependencies.
 */
const app = require('./app');
const debug = require('debug')('gcdiscordbot:server');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const dotenv = require('dotenv');

// discord
const Discord = require('discord.js');
const client = new Discord.Client();



if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  dotenv.config({path: '.env'});
} else {
  dotenv.config({path: '.env.example', silent: true});
}


/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);

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
  const port = parseInt(val, 10);

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

  const bind = typeof port === 'string'
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
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}


client.on('ready', () => {
  console.log('I am ready!');
});

var curVoiceChannel;
client.on('message', message => {
  const channel = message.channel;
  var command;
  var commandSize;

  // ignore bot's messages and determine whether the message is a command
  if(!message.author.bot && message.content.startsWith('!')) {
    // break up user message
    command = message.content.split(' ');
    commandSize = command.length;
  }

  // validate command and make sure command isn't empty
  if(command && command.length > 0) {
    switch (command[0].toLowerCase()) {
      case '!ping':
        channel.sendMessage('pong');
        break;
      case '!join':
        if (!message.guild) {
          message.reply('This feature is not available');
          return;
        }

        // set the channel name if there are enough parameters
        const channelName = commandSize > 1 ? command[1] : null;
        if(!channelName) {
          message.reply('Please specify the voice channel to join');
          return;
        }
        const voiceChannel = message.guild.channels.find("name", channelName);
        if (!voiceChannel || voiceChannel.type !== 'voice') {
          return message.reply(`I couldn't find the voice channel ${channelName}.`);
        }
        voiceChannel.join()
          .then(conn => {
            // save the current voice channel
            curVoiceChannel = voiceChannel;
            // create our voice receiver
            const receiver = conn.createReceiver();

            conn.on('speaking', (user, speaking) => {
              if (speaking) {
                // this creates a 8-bit signed PCM, stereo from PCM file
                const audioStream = receiver.createPCMStream(user);
                // create an output stream so we can dump our data in a file
                const outputStream = generateOutputFile(voiceChannel, user);
                // pipe our audio data into the file stream
                audioStream.pipe(outputStream);
                // when the stream ends (the user stopped talking) tell the user
                audioStream.on('end', () => {
                  convertAudio(outputStream.path, channel, user);
                });
              }
            });
          })
          .catch(console.log);

        break;
      case '!leave':
        if(curVoiceChannel)
          curVoiceChannel.leave();
        curVoiceChannel = null;
        break;
      case '!help':
        channel.sendMessage(`
!help - Get help
!join VoiceChannelName - Join specified voice channel and transcribe speech
!leave - Leave the current voice channel
!ping - Pong
          `);
        break;
      default:
        channel.sendMessage('Command not found. Please use !help to see the list of commands');
    }
  }
});



/**
 * create a new writable stream everytime someone starts to talk, which will then be used to write to file
 * @param channel the channel where the command was executed from
 * @param user name of the user that spoke
 */
function generateOutputFile(channel, user) {
  // use IDs instead of username cause some people have stupid emojis in their name
  const fileName = `./recordings/${channel.id}-${user.id}-${Date.now()}.pcm`;
  return fs.createWriteStream(fileName);
}

/**
 * convert audio files to flac audio 8khz sample rate 16bit mono channel
 * @param filePath absolute path to the file that should get converted
 * @param channel the channel where the prediction will be displayed in
 * @param user name of the user that spoke
 */
function convertAudio(filePath, channel, user) {
  exec('ffmpeg -f s32le -i ' + filePath + ' -acodec pcm_s16le -ar 8000 -ac 1 ' + filePath + '.wav', (err, stdout, stderr) => {
    if (err) {
      // node couldn't execute the command
      return;
    }
    outputText(filePath, channel, user);
  });
}

/**
 *
 * @param filePath absolute path to the file that should get converted
 * @param channel the channel where the prediction will be displayed in
 * @param user name of the user that spoke
 */
function outputText(filePath, channel, user) {
  console.log(path);
  var fileName = path.basename(filePath);

  exec('kaldi/egs/aspire/s5/predict.sh ../../../../recordings/' + fileName + '.wav', (err, stdout, stderr) => {
    var myRe = new RegExp('\nutterance-id1.*\n');
    var result = myRe.exec(stderr);

    // don't display message if prediction yielded no results
    if(!result)
      return;

    var msg = user + ' said ' + result;
    msg = msg.replace('utterance-id1', '');
    // clean up audio files since they're not needed anymore
    fs.unlink('/mnt/c/Users/Cardinality/Documents/GitHub/GCDiscordBot/recordings/' + fileName, function() { console.log('pcm removed'); });
    fs.unlink('/mnt/c/Users/Cardinality/Documents/GitHub/GCDiscordBot/recordings/' + fileName + '.wav', function() { console.log('wav removed'); });
    channel.sendMessage(msg);
  });
}

// start up the bot
client.login(process.env.DiscordToken);
