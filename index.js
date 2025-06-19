const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const moment = require('moment');
const fca = require('ws3-fca');
const axios = require('axios');
const { execSync } = require('child_process');
const express = require('express');
const { WebSocketServer } = require('ws');
const pm2 = require('pm2');

let globalConfig;
let appState;

try {
  globalConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch (error) {
  console.error(chalk.red('[Config Error] Failed to parse config.json:'), error.message);
  process.exit(1);
}

try {
  appState = JSON.parse(fs.readFileSync('appState.json', 'utf8'));
} catch (error) {
  console.error(chalk.red('[AppState Error] Failed to parse appState.json:'), error.message);
  process.exit(1);
}

const langCode = globalConfig.language || 'en';
let pathLanguageFile = path.join(__dirname, 'languages', `${langCode}.lang`);

if (!fs.existsSync(pathLanguageFile)) {
  console.warn(`Can't find language file ${langCode}, using default language file "en.lang"`);
  pathLanguageFile = path.join(__dirname, 'languages', 'en.lang');
}

const readLanguage = fs.readFileSync(pathLanguageFile, "utf-8");
const languageData = readLanguage
  .split(/\r?\n|\r/)
  .filter(line => line && !line.trim().startsWith("#") && !line.trim().startsWith("//") && line !== "");

global.language = {};
for (const sentence of languageData) {
  const getSeparator = sentence.indexOf('=');
  const itemKey = sentence.slice(0, getSeparator).trim();
  const itemValue = sentence.slice(getSeparator + 1).trim();
  const head = itemKey.slice(0, itemKey.indexOf('.'));
  const key = itemKey.replace(head + '.', '');
  const value = itemValue.replace(/\\n/gi, '\n');
  if (!global.language[head]) global.language[head] = {};
  global.language[head][key] = value;
}

function getText(head, key, ...args) {
  if (!global.language[head]?.[key]) return `Can't find text: "${head}.${key}"`;
  let text = global.language[head][key];
  for (let i = args.length - 1; i >= 0; i--) text = text.replace(new RegExp(`%${i + 1}`, 'g'), args[i]);
  return text;
}

// Bot start time for uptime calculation
const startTime = Date.now();

// Set up Express web server
const app = express();
let PORT = process.env.PORT || 28140; // Default to 28140 for ip.ozima.cloud:28140
const MAX_PORT_ATTEMPTS = 5; // Try up to 5 ports if the default is in use

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));


async function startServer(attempt = 0) {
  try {
    const server = await new Promise((resolve, reject) => {
      const serverInstance = app.listen(PORT, () => {
        console.log(`[Index] Web server running on port ${PORT}`);
        resolve(serverInstance);
      }).on('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
          console.warn(`[Index] Port ${PORT} is in use, trying port ${PORT + 1}...`);
          PORT++;
          startServer(attempt + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });


    const wss = new WebSocketServer({ server });

    // Store console logs
    const logs = [];

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    function broadcastLog(message, type = 'log') {
      const logEntry = { type, message: `[${new Date().toISOString()}] ${message}`, timestamp: Date.now() };
      logs.push(logEntry);
 
      if (logs.length > 100) logs.shift();

      wss.clients.forEach(client => {
        if (client.readyState === 1) { 
          client.send(JSON.stringify({ type: 'log', data: logEntry }));
        }
      });
    }

    console.log = (...args) => {
      const message = args.join(' ');
      broadcastLog(message, 'log');
      originalConsoleLog.apply(console, args);
    };

    console.error = (...args) => {
      const message = args.join(' ');
      broadcastLog(message, 'error');
      originalConsoleError.apply(console, args);
    };

    console.warn = (...args) => {
      const message = args.join(' ');
      broadcastLog(message, 'warn');
      originalConsoleWarn.apply(console, args);
    };


    wss.on('connection', (ws) => {
      console.log('[WebSocket] Client connected');


      async function checkBotStatus(retries = 3, delay = 1000) {
        return new Promise((resolve) => {
          pm2.connect((err) => {
            if (err) {
              console.error('[PM2] Failed to connect:', err.message);
              resolve({ status: 'running', uptime: Math.floor((Date.now() - startTime) / 1000) });
              return;
            }

            pm2.describe('bot', (err, description) => {
              pm2.disconnect();
              if (err || !description || description.length === 0) {
                console.error('[PM2] Failed to get bot status:', err ? err.message : 'No process found');
                if (retries > 0) {
                  console.log(`[PM2] Retrying (${retries} attempts left)...`);
                  setTimeout(() => {
                    checkBotStatus(retries - 1, delay).then(resolve);
                  }, delay);
                } else {
               
                  const uptime = Math.floor((Date.now() - startTime) / 1000);
                  resolve({ status: 'running', uptime });
                }
              } else {
                const status = description[0].pm2_env.status === 'online' ? 'running' : 'stopped';
                const uptime = Math.floor((Date.now() - startTime) / 1000);
                resolve({ status, uptime });
              }
            });
          });
        });
      }

      // Send initial data (status, uptime, logs)
      checkBotStatus().then(({ status, uptime }) => {
        ws.send(JSON.stringify({ type: 'status', data: { status, uptime } }));
      });

      // Send all existing logs
      ws.send(JSON.stringify({ type: 'logs', data: logs }));
    });

    wss.on('close', () => {
      console.log('[WebSocket] Client disconnected');
    });
  } catch (err) {
    console.error('[Index] Failed to start web server:', err.message);
    process.exit(1);
  }
}

// Start the web server
startServer();

const commands = new Map();
const events = new Map();
const commandsDir = path.join(__dirname, 'scripts', 'commands');
const eventsDir = path.join(__dirname, 'scripts', 'events');

const chalkGradient = (text) => {
  const colors = ['#00FFFF', '#55AAFF', '#AA55FF', '#FF55AA', '#FF5555'];
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const colorIndex = Math.floor((i / text.length) * colors.length);
    result += chalk.hex(colors[colorIndex])(text[i]);
  }
  return result;
};

const abstractBox = chalk.hex('#55FFFF')('═══════✨═══════✨═══════✨═══════');

fs.readdirSync(commandsDir).forEach(file => {
  if (file.endsWith('.js') && !fs.lstatSync(path.join(commandsDir, file)).isDirectory()) {
    try {
      const command = require(path.join(commandsDir, file));
      commands.set(command.config.name.toLowerCase(), command);
      console.log(chalk.hex('#00FFFF')(`✨ Command Loaded: ${chalkGradient(command.config.name)} ✨`));
    } catch (error) {
      console.error(chalk.hex('#FF5555')(`🔥 Command Load Failed: ${file} - ${error.message}`));
    }
  }
});

if (fs.existsSync(eventsDir)) {
  fs.readdirSync(eventsDir).forEach(file => {
    if (file.endsWith('.js')) {
      try {
        const eventHandler = require(path.join(eventsDir, file));
        events.set(eventHandler.name.toLowerCase(), eventHandler);
        console.log(chalk.hex('#00FFFF')(`✨ Event Handler Loaded: ${chalkGradient(eventHandler.name)} ✨`));
      } catch (error) {
        console.error(chalk.hex('#FF5555')(`🔥 Event Handler Load Failed: ${file} - ${error.message}`));
      }
    }
  });
}

global.commands = commands;

let lastCommitSha = null;
let api = null;

async function checkForUpdates() {
  try {
    const { data: lastCommit } = await axios.get('https://api.github.com/repos/1dev-hridoy/Messenger-NexaloSIM-Bot/commits/main');
    const currentCommitSha = lastCommit.sha;

    if (!lastCommitSha) {
      lastCommitSha = currentCommitSha;
      console.log(chalk.green('[Update Check] Initial commit SHA:', lastCommitSha));
      return { isUpdateAvailable: false, commit: null };
    }

    if (lastCommitSha !== currentCommitSha) {
      console.log(chalk.green('[Update Check] New commit detected:', currentCommitSha));
      lastCommitSha = currentCommitSha;
      return { isUpdateAvailable: true, commit: lastCommit };
    } else {
      console.log(chalk.blue('[Update Check] No new updates available.'));
      return { isUpdateAvailable: false, commit: null };
    }
  } catch (error) {
    console.error(chalk.red('[Update Check Error]', error.message));
    throw error;
  }
}

fca({ appState }, (err, fcaApi) => {
  if (err) {
    console.error(chalk.hex('#FF5555')('🔥 Login Failed:'), err.stack);
    return;
  }

  api = fcaApi;

  console.log(chalk.hex('#00FFFF')(`🌟 ${chalkGradient(`${globalConfig.botName} is Online!`)} 🌟`));

  api.listenMqtt((err, event) => {
    if (err) {
      console.error(chalk.hex('#FF5555')('🔥 MQTT Error:'), err?.stack || err);
      return;
    }

    if (event && event.type === 'message') {
      const message = event.body || '';
      const senderID = event.senderID;
      const threadID = event.threadID;
      const messageID = event.messageID;
      const isImage = event.attachments && event.attachments.length > 0 && event.attachments[0].type === 'photo';

      api.getUserInfo(senderID, (err, userInfo) => {
        if (err) {
          console.error(chalk.hex('#FF5555')('🔥 User Info Fetch Failed:'), err);
          return;
        }

        const userName = userInfo[senderID]?.name || 'Unknown User';

        console.log(abstractBox);
        console.log(chalk.hex('#00FFFF')(`👤 User: ${chalkGradient(userName)}`));
        console.log(chalk.hex('#55AAFF')(`📩 Type: ${chalkGradient(isImage ? 'Image' : 'Text')}`));
        console.log(chalk.hex('#AA55FF')(`💬 Message: ${chalkGradient(isImage ? 'Image Attachment' : message)}`));
        console.log(chalk.hex('#FF55AA')(`🧵 Thread: ${chalkGradient(threadID)}`));
        console.log(abstractBox);

        const socialMediaDownloader = events.get('socialmediadownloader');
        if (socialMediaDownloader) {
          try {
            socialMediaDownloader.handle({ api, event });
          } catch (error) {
            console.error(chalk.red(`[SocialMediaDownloader Handler Error] ${error.message}`));
          }
        }

        const messageLower = message.toLowerCase().trim();
        let noPrefixCommand = null;

        for (const [name, command] of commands) {
          if (command.config.usePrefix === false) {
            if (messageLower === name || (command.config.aliases && command.config.aliases.includes(messageLower))) {
              noPrefixCommand = command;
              break;
            }
          }
        }

        if (noPrefixCommand) {
          try {
            noPrefixCommand.run({ api, event, args: messageLower.split(/\s+/), config: globalConfig, getText });
          } catch (error) {
            api.sendMessage(`⚠️ Error: ${error.message}`, threadID, messageID);
            console.error(chalk.hex('#FF5555')(`🔥 Command Crashed (${noPrefixCommand.config.name}):`), error.stack);
          }
          return;
        }

        if (message.startsWith(globalConfig.prefix)) {
          const [commandName, ...args] = message.slice(globalConfig.prefix.length).trim().split(/\s+/);
          const cmdNameLower = commandName.toLowerCase();

          let command = commands.get(cmdNameLower);
          if (!command) {
            for (const [name, cmd] of commands) {
              if (cmd.config.aliases && cmd.config.aliases.includes(cmdNameLower)) {
                command = cmd;
                break;
              }
            }
          }

          if (command) {
            const { config } = command;

            if (config.adminOnly && !globalConfig.adminUIDs.includes(senderID)) {
              api.setMessageReaction("❌", messageID, () => {}, true);
              return api.sendMessage(getText("general", "adminOnly"), threadID, messageID);
            }

            try {
              command.run({ api, event, args, config: globalConfig, getText });
            } catch (error) {
              api.setMessageReaction("❌", messageID, () => {}, true);
              api.sendMessage(`⚠️ Error: ${error.message}`, threadID, messageID);
              console.error(chalk.hex('#FF5555')(`🔥 Command Crashed (${commandName}):`), error.stack);
            }
          } else {
            api.setMessageReaction("❌", messageID, () => {}, true);
            api.sendMessage(`⚠️ Unknown command: ${commandName}`, threadID, messageID);
            console.log(chalk.hex('#FF5555')(`❓ Unknown Command: ${chalkGradient(commandName)} | Thread: ${chalkGradient(threadID)}`));
          }
        }
      });
    }

    if (event && event.type === 'event' && event.threadID) {
      const threadID = event.threadID;

      if (event.logMessageType === 'log:subscribe') {
        const joinHandler = events.get('join');
        if (joinHandler) {
          try {
            joinHandler.handle({ api, event });
          } catch (error) {
            console.error(chalk.red(`[Join Event Handler Error] ${error.message}`));
          }
        }
      }

      if (event.logMessageType === 'log:unsubscribe') {
        const leaveHandler = events.get('leave');
        if (leaveHandler) {
          try {
            leaveHandler.handle({ api, event });
          } catch (error) {
            console.error(chalk.red(`[Leave Event Handler Error] ${error.message}`));
          }
        }
      }
    }
  });
});
