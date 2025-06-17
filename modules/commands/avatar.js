const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../../includes/logger');

module.exports = {
    name: "avatar",
    version: "1.0.0",
    author: "Hridoy",
    description: "Sends the profile picture of the command user or a mentioned user.",
    adminOnly: false,
    commandCategory: "utility",
    guide: "Use {pn}avatar to get your avatar, or {pn}avatar @user to get their avatar.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        if (!event || !event.threadID || !event.messageID) {
            console.error("Invalid event object in avatar command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        let targetUid;
        let targetName = "User";

        if (args.length > 0 && event.mentions && Object.keys(event.mentions).length > 0) {
            targetUid = Object.keys(event.mentions)[0];
            targetName = event.mentions[targetUid].replace(/@/g, '');
        } else {
            targetUid = event.senderID;
            const userInfo = await new Promise((resolve) => {
                api.getUserInfo(targetUid, (err, info) => resolve(err ? {} : info));
            });
            targetName = userInfo[targetUid]?.name || "User";
        }

        const profilePicUrl = `https://graph.facebook.com/${targetUid}/picture?width=512&height=512&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;
        const tempFilePath = path.join(__dirname, `../../temp/avatar_${targetUid}.png`);
        await fs.ensureDir(path.dirname(tempFilePath));

        try {
            const imageResponse = await axios.get(profilePicUrl, { responseType: 'arraybuffer' });
            await fs.writeFile(tempFilePath, imageResponse.data);

            await new Promise((resolve, reject) => {
                api.sendMessage(
                    {
                        body: `${config.bot.botName}: Avatar of ${targetName}`,
                        attachment: fs.createReadStream(tempFilePath)
                    },
                    event.threadID,
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            await fs.unlink(tempFilePath);
            logger.info(`Sent avatar for user ${targetUid} (${targetName}) and deleted temp file`);
        } catch (error) {
            logger.error(`Error in avatar command for user ${targetUid}: ${error.message}`);
            api.sendMessage(`${config.bot.botName}: ❌ Failed to fetch or send the avatar.`, event.threadID);
        }
    }
};