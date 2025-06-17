const logger = require('../logger');
const config = require('../../config/config.json');
const language = require(`../../languages/${config.language}.json`);
const { connect } = require('../../includes/database');
const { updateUserMessageCount } = require('../../includes/database/user');
const fs = require('fs');
const path = require('path');

class EventHandler {
    constructor(api, commandHandler) {
        this.api = api;
        this.commandHandler = commandHandler;
        this.db = null;
        this.events = new Map();
        this.initDb();
        this.loadEvents();
    }

    async initDb() {
        this.db = await connect();
    }

    loadEvents() {
        const eventDir = path.join(__dirname, '../../modules/events');
        const files = fs.readdirSync(eventDir).filter(file => file.endsWith('.js'));

        for (const file of files) {
            const event = require(path.join(eventDir, file));
            this.events.set(event.name, event);
            logger.info(`Loaded event: ${event.name}`);
        }
    }

    async handleEvent(event) {
        if (!event) {
            logger.error('Received undefined event in eventHandler');
            return;
        }

        logger.verbose(`Event received in eventHandler: ${JSON.stringify(event, null, 2)}`);


        if (event.logMessageType === "log:subscribe") {
            const joinEvent = this.events.get("join");
            if (joinEvent) {
                await joinEvent.handle({ api: this.api, event });
            }
        }

        if (event.logMessageType === "log:unsubscribe") {
            const leaveEvent = this.events.get("leave");
            if (leaveEvent) {
                await leaveEvent.handle({ api: this.api, event });
            }
        }

  
        if (event.type === 'message' || event.type === 'message_reply') {
            const isGroup = event.isGroup ? 'Group' : 'Inbox';
            this.api.getUserInfo(event.senderID, (err, userInfo) => {
                if (err) {
                    logger.error(`Failed to get user info: ${err.message}`);
                    return;
                }
                const senderName = userInfo[event.senderID]?.name || 'Unknown';
                const logMessage = language.messageLog
                    .replace('{context}', isGroup)
                    .replace('{sender}', senderName)
                    .replace('{body}', event.body || '(no text)');
                logger.info(logMessage);
            });

            if (this.db) {
                await updateUserMessageCount(this.db, event.senderID, event.threadID);
            }

            if (event.type === 'message_reply' && global.replyHandlers?.has(event.messageReply.messageID)) {
                logger.info(`Reply detected for message ID: ${event.messageReply.messageID}`);
                const replyData = global.replyHandlers.get(event.messageReply.messageID);
                logger.info(`Reply handler found: ${JSON.stringify(replyData)}`);
                const command = require(`../../modules/commands/${replyData.commandName}`);
                if (command.onReply) {
                    logger.info(`Calling onReply for command: ${replyData.commandName}`);
                    await command.onReply({ api: this.api, event });
                } else {
                    logger.warn(`No onReply method found for command: ${replyData.commandName}`);
                }
                return;
            }

            if (event.body && event.body.toLowerCase() === 'ping') {
                const response = `${config.bot.botName}: ${language.pingResponse}`;
                this.api.sendMessage(response, event.threadID, (sendErr) => {
                    if (sendErr) {
                        logger.error(`Failed to send message: ${sendErr.message}`);
                    } else {
                        logger.info(`Sent: ${response}`);
                    }
                });
                return;
            }

            await this.commandHandler.handleCommand(event);
        }
    }
}

module.exports = EventHandler;