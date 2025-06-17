const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const ANIME_LOGO_API_URL = 'https://nexalo-api.vercel.app/api/anime-logo-generator';
// ==========================

module.exports = {
    name: "alogo",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate an anime-style logo with your text and a selected style 🎨",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}alogo <text> <style> to generate an anime logo.\n" +
           "<style> must be a number between 1 and 5.\n" +
           "Example: {pn}alogo Hridoy 2",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        let filePath;

        try {
            if (!event || !threadID || !messageID) {
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            if (args.length < 2) {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide both text and style. Example: {pn}alogo Hridoy 2`,
                    threadID,
                    messageID
                );
            }

            const style = args[args.length - 1];
            const text = args.slice(0, -1).join(" ").trim();

            if (!text) {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide text for the logo. Example: {pn}alogo Hridoy 2`,
                    threadID,
                    messageID
                );
            }

            if (!/^[1-5]$/.test(style)) {
                return api.sendMessage(
                    `${config.bot.botName}: Style must be a number between 1 and 5. Example: {pn}alogo Hridoy 2`,
                    threadID,
                    messageID
                );
            }

            const apiUrl = `${ANIME_LOGO_API_URL}?text=${encodeURIComponent(text)}&number=${style}`;
            const response = await axios.get(apiUrl, { timeout: 30000 });

            const result = response.data;

            if (!result.status || !result.url) {
                throw new Error(result.message || "Failed to generate anime logo");
            }

            const imageUrl = result.url;

            const imageResponse = await axios.get(imageUrl, {
                responseType: 'stream',
                timeout: 30000
            });

            const contentType = imageResponse.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                throw new Error("API response is not an image");
            }

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `alogo_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            imageResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const stats = fs.statSync(filePath);
            if (stats.size === 0) throw new Error("Downloaded anime logo image is empty");

            const msg = {
                body: `${config.bot.botName}: 🎨 Anime logo generated for "${text}" (Style ${style})!`,
                attachment: fs.createReadStream(filePath)
            };

            await api.sendMessage(msg, threadID);

            fs.unlinkSync(filePath);
        } catch (err) {
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );

            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }
};