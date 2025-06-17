const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const os = require('os');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const startTime = Date.now();

module.exports = {
    name: "uptime",
    version: "1.0.0",
    author: "Hridoy",
    description: "Displays the bot's uptime and server information with a custom uptime card.",
    adminOnly: false,
    commandCategory: "Utility",
    guide: "Use {pn}uptime to check the bot's uptime and server details.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in uptime command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            logger.info(`Received command: .uptime in thread ${threadID}`);

       
            const uptimeMs = Date.now() - startTime;
            const seconds = Math.floor((uptimeMs / 1000) % 60);
            const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
            const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
            const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
            const totalSeconds = Math.floor(uptimeMs / 1000);

         
            const totalMemory = (os.totalmem() / (1024 ** 3)).toFixed(2);
            const freeMemory = (os.freemem() / (1024 ** 3)).toFixed(2);
            const usedMemory = (totalMemory - freeMemory).toFixed(2);
            const cpuModel = os.cpus()[0].model;
            const cpuCores = os.cpus().length;
            const platform = os.platform();
            const hostname = os.hostname();

            const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

            const botName = config.bot.botName;
            const ownerName = config.bot.ownerName;
            const botImageUrl = "https://i.ibb.co/gpgY3fy/download-3.jpg"; 

   
            const apiUrl = `https://nexalo-api.vercel.app/api/uptime-card?image=${encodeURIComponent(botImageUrl)}&botname=${encodeURIComponent(botName)}&uptime=${totalSeconds}&developer=${encodeURIComponent(ownerName)}`;
            console.log(`Fetching uptime card from ${apiUrl}`);

            const tempDir = path.join(__dirname, '../../temp');
            await fs.ensureDir(tempDir);
            const fileName = `uptime_${Date.now()}.png`;
            const filePath = path.join(tempDir, fileName);

            const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 10000 });
            await fs.writeFile(filePath, response.data);
            console.log(`Uptime card saved to ${filePath}`);

            const stats = await fs.stat(filePath);
            if (stats.size === 0) throw new Error("Downloaded uptime card image is empty");


            const msgBody = `┌──────────────────┐\n` +
                           `│ ${botName}: Bot Status │\n` +
                           `└──────────────────┘\n\n` +
                           `⏰ Uptime: ${uptimeStr}\n\n` +
                           `┌─ 🖥️ Server Info ─┐\n` +
                           `│ Hostname: ${hostname}\n` +
                           `│ Platform: ${platform}\n` +
                           `│ CPU: ${cpuModel}\n` +
                           `│ Cores: ${cpuCores}\n` +
                           `│ Memory: ${usedMemory}GB / ${totalMemory}GB\n` +
                           `│ Free: ${freeMemory}GB\n` +
                           `└──────────────────┘`;

            const msg = {
                body: msgBody,
                attachment: fs.createReadStream(filePath)
            };

            logger.info("Sending uptime and server info with card");
            await api.sendMessage(msg, threadID, messageID);
            logger.info("Uptime info and card sent successfully");
            console.log(`Sent uptime card and info to thread ${threadID}`);

     
            await fs.unlink(filePath);
            console.log(`Cleaned up ${filePath}`);
        } catch (err) {
            logger.error(`Error in uptime command: ${err.message}`, { stack: err.stack });
            console.log(`Error in uptime command: ${err.message}`);
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );
        }
    }
};