const config = require('../../config/config.json');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../includes/logger');

module.exports = {
    name: "vip",
    version: "1.0.0",
    author: "Hridoy",
    description: "Manages the bot VIP list (admin only).",
    adminOnly: true,
    commandCategory: "admin",
    guide: "Use {pn}vip to see VIP list, {pn}vip add @user to add, or {pn}vip remove @user to remove.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        if (!event || !event.threadID || !event.messageID) {
            logger.error("Invalid event object in vip command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        const vipFilePath = path.join(__dirname, '../../assets/vip.json');
        let vipData;
        try {
            const fileContent = await fs.readFile(vipFilePath, 'utf8');
            vipData = JSON.parse(fileContent);
        } catch (err) {
            logger.error(`Failed to read vip.json: ${err.message}`);
            vipData = { vips: [] };
        }

        if (args.length === 0) {
            const vipUids = vipData.vips;
            if (vipUids.length === 0) {
                logger.info(`No VIPs found for thread ${event.threadID}`);
                return api.sendMessage(`${config.bot.botName}: No VIPs found.`, event.threadID);
            }

            const vipInfo = await new Promise((resolve) => api.getUserInfo(vipUids, (err, info) => resolve(err ? {} : info)));
            const vipList = vipUids.map(uid => {
                const vipName = vipInfo[uid]?.name || uid;
                return `- ${vipName} (ID: ${uid})`;
            });

            const message = [
                `╔═━─[ ${config.bot.botName} VIP LIST ]─━═╗`,
                `┃ ${vipList.join('\n┃ ')}`,
                `╚═━──────────────────────────────━═╝`
            ].join('\n');

            logger.info(`Listed ${vipUids.length} VIPs for thread ${event.threadID}`);
            return api.sendMessage(message, event.threadID);
        }

        if (!event.mentions || Object.keys(event.mentions).length === 0) {
            logger.warn(`No user mentioned for vip command in thread ${event.threadID}`);
            return api.sendMessage(`${config.bot.botName}: ⚠️ Please mention a user to add or remove as VIP.`, event.threadID);
        }

        const targetUid = Object.keys(event.mentions)[0];
        const targetName = event.mentions[targetUid].replace(/@/g, '');
        const isAdd = args[0].toLowerCase() === "add";
        const isRemove = args[0].toLowerCase() === "remove";

        if (!isAdd && !isRemove) {
            logger.warn(`Invalid vip action '${args[0]}' in thread ${event.threadID}`);
            return api.sendMessage(`${config.bot.botName}: ⚠️ Invalid action. Use 'add' or 'remove'. ${this.guide}`, event.threadID);
        }

        let vipUids = vipData.vips;

        if (isAdd) {
            if (vipUids.includes(targetUid)) {
                logger.info(`User ${targetUid} already a VIP in thread ${event.threadID}`);
                return api.sendMessage(`${config.bot.botName}: ⚠️ ${targetName} is already a VIP.`, event.threadID);
            }
            vipUids.push(targetUid);
        } else if (isRemove) {
            if (!vipUids.includes(targetUid)) {
                logger.info(`User ${targetUid} not a VIP in thread ${event.threadID}`);
                return api.sendMessage(`${config.bot.botName}: ⚠️ ${targetName} is not a VIP.`, event.threadID);
            }
            vipUids = vipUids.filter(uid => uid !== targetUid);
        }

        vipData.vips = vipUids;
        try {
            await fs.writeFile(vipFilePath, JSON.stringify(vipData, null, 2));
        } catch (err) {
            logger.error(`Failed to write vip.json: ${err.message}`);
            return api.sendMessage(`${config.bot.botName}: ❌ Failed to update VIP list. Please try again.`, event.threadID);
        }

        const action = isAdd ? "added as VIP" : "removed from VIP list";
        logger.info(`${targetName} (ID: ${targetUid}) ${action}`);
        api.sendMessage(`${config.bot.botName}: ✅ ${targetName} has been ${action}.`, event.threadID);
    }
};