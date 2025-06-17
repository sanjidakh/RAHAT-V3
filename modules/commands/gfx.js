const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const GFX_API_URL = 'https://nexalo-api.vercel.app/api/gfx';
// ==========================

module.exports = {
    name: "gfx",
    version: "1.0.1",
    author: "Hridoy",
    description: "Generate a GFX image with your text and selected style 🎨",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}gfx <text> <style> to generate a GFX image.\n" +
           "<style> must be a number between 1 and 4.\n" +
           "Example: {pn}gfx Hridoy 1",
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
                    `${config.bot.botName}: Please provide both text and style. Example: {pn}gfx Hridoy 1`,
                    threadID,
                    messageID
                );
            }

            const style = args[args.length - 1];
            const text = args.slice(0, -1).join(" ").trim();

            if (!text) {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide text for the GFX. Example: {pn}gfx Hridoy 1`,
                    threadID,
                    messageID
                );
            }

            if (!/^[1-4]$/.test(style)) {
                return api.sendMessage(
                    `${config.bot.botName}: Style must be a number between 1 and 4. Example: {pn}gfx Hridoy 1`,
                    threadID,
                    messageID
                );
            }

            const apiUrl = `${GFX_API_URL}?gfxname=${encodeURIComponent(text)}&gfxnumber=${style}`;

            logger.info(`Sending request to GFX API: ${apiUrl}`);
            const gfxResponse = await axios.get(apiUrl, { timeout: 30000 });

            if (!gfxResponse.data || !gfxResponse.data.status || !gfxResponse.data.url) {
                throw new Error(gfxResponse.data.message || "Failed to generate GFX image");
            }

            const gfxImageUrl = gfxResponse.data.url;
            logger.info(`GFX image generated successfully. Downloading from URL: ${gfxImageUrl}`);

            const imageResponse = await axios.get(gfxImageUrl, { responseType: 'stream', timeout: 15000 });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `gfx_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            imageResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: 🎨 Here's your GFX image for "${text}" with style ${style}!`,
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