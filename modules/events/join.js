const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path'); 
const chalk = require('chalk');
const logger = require('../../includes/logger');

const GRAPH_API_BASE = 'https://graph.facebook.com';
const FB_HARDCODED_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662';
const WELCOME_API_URL = 'https://nexalo-api.vercel.app/api/welcome-card';

function getProfilePictureURL(userID, size = [512, 512]) {
    const [height, width] = size;
    return `${GRAPH_API_BASE}/${userID}/picture?width=${width}&height=${height}&access_token=${FB_HARDCODED_TOKEN}`;
}

const randomQuotes = [
    "Welcome aboard, let's achieve greatness!",
    "New adventures start with great friends.",
    "Together, we can conquer the world!",
    "Welcome to the team of dreamers.",
    "A new journey begins with you.",
    "Let’s make today a memorable one.",
    "Excited to have you here, welcome!",
    "We grow stronger with you here.",
    "New beginnings, new hopes, welcome!",
    "Welcome to the group of achievers."
];

module.exports = {
    name: "join",
    async handle({ api, event }) {
        if (event.logMessageType !== "log:subscribe") return;

        const threadID = event.threadID;
        const addedUsers = event.logMessageData.addedParticipants || [];

        try {
            const groupInfo = await new Promise((resolve, reject) => {
                api.getThreadInfo(threadID, (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            const groupName = groupInfo.threadName || "the group";

            for (const user of addedUsers) {
                const userID = user.userFbId;
                const userInfo = await new Promise((resolve, reject) => {
                    api.getUserInfo([userID], (err, info) => {
                        if (err) reject(err);
                        else resolve(info);
                    });
                });
                const userName = userInfo[userID]?.name || "Unknown User";

                const profilePicUrl = getProfilePictureURL(userID);
                const randomQuote = randomQuotes[Math.floor(Math.random() * randomQuotes.length)];
                const apiUrl = `${WELCOME_API_URL}?image=${encodeURIComponent(profilePicUrl)}&username=${encodeURIComponent(userName)}&text=${encodeURIComponent(randomQuote)}`;

                const tempDir = path.join(__dirname, '../../temp');
                await fs.ensureDir(tempDir);
                const fileName = `welcome_${Date.now()}_${userID}.png`;
                const filePath = path.join(tempDir, fileName);

                const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 10000 });
                await fs.writeFile(filePath, response.data);

                const stats = await fs.stat(filePath);
                if (stats.size === 0) throw new Error("Downloaded welcome image is empty");

                const msg = {
                    body: `${config.bot.botName}: 🎉 Welcome ${userName} to ${groupName}!`,
                    attachment: fs.createReadStream(filePath)
                };

                await new Promise((resolve, reject) => {
                    api.sendMessage(msg, threadID, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                await fs.unlink(filePath);
                logger.info(`Welcomed ${userName} (ID: ${userID}) to thread ${threadID}`);
            }
        } catch (error) {
            logger.error(`Failed to welcome new user in thread ${threadID}: ${error.message}`);
            api.sendMessage(`${config.bot.botName}: ⚠️ Failed to welcome new user.`, threadID);

            const tempDir = path.join(__dirname, '../../temp');
            const fileName = `welcome_${Date.now()}_${userID}.png`;
            const filePath = path.join(tempDir, fileName);
            if (await fs.exists(filePath)) {
                await fs.unlink(filePath);
            }
        }
    }
};