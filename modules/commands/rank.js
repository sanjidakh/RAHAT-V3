const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { connect } = require('../../includes/database');
const logger = require('../../includes/logger');

module.exports = {
    name: "rank",
    version: "1.0.0",
    author: "Hridoy",
    description: "Shows the rank card of the command user or a mentioned user.",
    adminOnly: false,
    commandCategory: "utility",
    guide: "Use {pn}rank to show your rank, or {pn}rank @user to show their rank.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        if (!event || !event.threadID || !event.messageID) {
            console.error("Invalid event object in rank command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        const db = await connect();
        const usersCollection = db.collection('users');

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

        const user = await usersCollection.findOne({ userId: targetUid });
        if (!user) {
            return api.sendMessage(`${config.bot.botName}: ⚠️ User not found in database.`, event.threadID);
        }

        const profilePicUrl = `https://graph.facebook.com/${targetUid}/picture?width=512&height=512&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;
        const rank = user.rank || 1;
        const xp = user.xp || 0;
        const nextLevelXp = rank * 100;

        const rankApiUrl = `https://nexalo-api.vercel.app/api/rank-v3?name=${encodeURIComponent(targetName)}&level=${rank}&rank=${rank}&requiredXP=${nextLevelXp}&xp=${xp}&image=${encodeURIComponent(profilePicUrl)}`;

        try {
            const rankResponse = await axios.get(rankApiUrl);
            if (!rankResponse.data.status || !rankResponse.data.url) {
                throw new Error("Failed to generate rank card");
            }

            const imageUrl = rankResponse.data.url;
            const tempFilePath = path.join(__dirname, `../../temp/rank_${targetUid}.png`);
            await fs.ensureDir(path.dirname(tempFilePath));

            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            await fs.writeFile(tempFilePath, imageResponse.data);

            await new Promise((resolve, reject) => {
                api.sendMessage(
                    {
                        body: `${config.bot.botName}: Rank card for ${targetName}`,
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
            logger.info(`Sent rank card for user ${targetUid} and deleted temp file`);
        } catch (error) {
            logger.error(`Error in rank command for user ${targetUid}: ${error.message}`);
            api.sendMessage(`${config.bot.botName}: ❌ Failed to generate or send rank card.`, event.threadID);
        }
    }
};