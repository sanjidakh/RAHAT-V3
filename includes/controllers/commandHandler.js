const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const config = require('../../config/config.json');
const language = require(`../../languages/${config.language}.json`);
const { connect } = require('../../includes/database');

class CommandHandler {
    constructor(api) {
        this.api = api;
        this.commands = new Map();
        this.cooldowns = new Map();
        this.reactionHandlers = new Map();
        this.replyHandlers = new Map();
        this.db = null;
        this.initDb();
        this.loadCommands();
    }

    async initDb() {
        this.db = await connect();
    }

    loadCommands() {
        const commandDir = path.join(__dirname, '../../modules/commands');
        const files = fs.readdirSync(commandDir).filter(file => file.endsWith('.js'));

        for (const file of files) {
            const command = require(path.join(commandDir, file));
            this.commands.set(command.name, command);
            logger.info(`Loaded command: ${command.name}`);
        }
    }

    async handleCommand(event) {
        if (!event || (event.type !== 'message' && event.type !== 'message_reply') || !event.body) {
            logger.error('Invalid event object in handleCommand');
            return;
        }

        const botID = this.api.getCurrentUserID();
        if (event.senderID === botID) {
            logger.verbose('Ignoring message from bot itself');
            return;
        }

        if (this.db) {
            const usersCollection = this.db.collection('users');
            const user = await usersCollection.findOne({ userId: event.senderID });
            if (user && user.ban) {
                this.api.sendMessage('You are banned from using this bot.', event.threadID);
                return;
            }

            const settingsCollection = this.db.collection('settings');
            const adminOnlySetting = await settingsCollection.findOne({ setting: "adminOnlyMode" });
            const adminOnlyMode = adminOnlySetting ? adminOnlySetting.value : false;

            const adminUids = config.bot.adminUids || [];
            if (adminOnlyMode && !adminUids.includes(String(event.senderID))) {
                this.api.sendMessage(
                    `${config.bot.botName}: Admin-only mode is on. Only admins can use bot commands.`,
                    event.threadID,
                    event.messageID
                );
                return;
            }
        }

        const prefix = config.bot.prefix;
        const bodyLower = event.body.toLowerCase().trim();
        let commandName;
        let args;

        if (bodyLower === prefix.toLowerCase()) {
            commandName = "prefix";
            args = [];
        } else if (bodyLower.startsWith(prefix.toLowerCase())) {
            const parts = event.body.slice(prefix.length).trim().split(' ');
            commandName = parts[0].toLowerCase();
            args = parts.slice(1);
        } else {
            const parts = event.body.trim().split(' ');
            commandName = parts[0].toLowerCase();
            args = parts.slice(1);
        }

        const command = this.commands.get(commandName);
        if (!command) return;

        if (command.usePrefix && !event.body.toLowerCase().startsWith(prefix.toLowerCase())) {
            logger.verbose(`Command ${command.name} requires prefix but none was used`);
            this.api.sendMessage(
                `${config.bot.botName}: Prefix '${prefix}' is required for the ${command.name} command.`,
                event.threadID,
                event.messageID
            );
            return;
        }

        if (!command.usePrefix && event.body.toLowerCase().startsWith(prefix.toLowerCase())) {
            logger.verbose(`Command ${command.name} does not require prefix but prefix was used`);
            this.api.sendMessage(
                `${config.bot.botName}: No prefix is required for the ${command.name} command.`,
                event.threadID,
                event.messageID
            );
            return;
        }

        if (command.adminOnly) {
            const adminUids = config.bot.adminUids || [];
            logger.verbose(`Admin check: senderID=${event.senderID}, adminUids=${JSON.stringify(adminUids)}`);
            if (!adminUids.includes(String(event.senderID))) {
                logger.warn(`Unauthorized command ${commandName} attempt by ${event.senderID} in thread ${event.threadID}`);
                this.api.sendMessage(`${config.bot.botName}: ❌ This command is for admins only.`, event.threadID);
                return;
            }
        }

        const cooldownKey = `${event.senderID}-${command.name}`;
        const now = Date.now();
        const cooldownTime = (command.cooldowns || 0) * 1000;

        if (this.cooldowns.has(cooldownKey)) {
            const expiration = this.cooldowns.get(cooldownKey);
            if (now < expiration) {
                const secondsLeft = Math.ceil((expiration - now) / 1000);
                this.api.sendMessage(
                    language.cooldownError.replace('{seconds}', secondsLeft),
                    event.threadID
                );
                return;
            }
        }

        try {
            logger.verbose(`Executing command: ${command.name} in thread ${event.threadID}`);
            await command.execute({ api: this.api, event, args, commandHandler: this });
            this.cooldowns.set(cooldownKey, now + cooldownTime);
        } catch (err) {
            logger.error(`Command ${commandName} failed: ${err.message}`);
            this.api.sendMessage('An error occurred while executing the command.', event.threadID);
        }
    }

    async handleReaction(event) {
        if (!event || !event.messageID) return;
        const handler = this.reactionHandlers.get(event.messageID);
        if (handler && event.userID === handler.authorID) {
            await handler.onReaction(event);
            this.reactionHandlers.delete(event.messageID);
        }
    }

    async handleReply(event) {
        if (!event || !event.messageReply) return;
        const handler = this.replyHandlers.get(event.messageReply.messageID);
        if (handler && event.senderID === handler.authorID) {
            await handler.onReply(event);
            this.replyHandlers.delete(event.messageReply.messageID);
        }
    }
}

module.exports = CommandHandler;