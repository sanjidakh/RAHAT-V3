const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
    name: "pinterest",
    version: "1.0.0",
    author: "Hridoy",
    description: "Search for Pinterest images based on a given image name.",
    adminOnly: false,
    commandCategory: "Search",
    guide: "{pn}pinterest <image name> - Search Pinterest for images with the given name.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const args = event.body.split(' ').slice(1);
        const prefix = config.prefix || ".";

        if (!args[0]) {
            return api.sendMessage(`${config.bot.botName}: ❌ Please provide an image name to search (e.g., ${prefix}pinterest nature).`, threadID, messageID);
        }

        const imageName = args.join(' ');
        console.log(`Searching Pinterest for: ${imageName}`);

        try {
            const apiUrl = `https://nexalo-api.vercel.app/api/pinterest?text=${encodeURIComponent(imageName)}`;
            console.log(`Sending request to ${apiUrl}`);

            const response = await axios.get(apiUrl, { timeout: 10000 });
            const data = response.data;
            console.log(`API response received: ${JSON.stringify(data)}`);

            if (!data.response || !Array.isArray(data.response) || data.response.length === 0) {
                return api.sendMessage(`${config.bot.botName}: ❌ No images found for "${imageName}".`, threadID, messageID);
            }

            const tempDir = path.join(__dirname, '../../temp');
            await fs.ensureDir(tempDir);

            const imageUrls = data.response;
            const attachments = [];

            for (const url of imageUrls) {
                const fileName = `pinterest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
                const filePath = path.join(tempDir, fileName);
                console.log(`Downloading image from ${url} to ${filePath}`);

                const imageResponse = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
                await fs.writeFile(filePath, imageResponse.data);

                attachments.push(fs.createReadStream(filePath));
                console.log(`Image saved: ${filePath}`);
            }

            const msg = {
                body: `${config.bot.botName}: 📌 Found ${imageUrls.length} images for "${imageName}"!`,
                attachment: attachments
            };

            await api.sendMessage(msg, threadID, messageID);
            console.log(`Sent ${imageUrls.length} images to thread ${threadID}`);

            for (const attachment of attachments) {
                await fs.unlink(attachment.path).catch(err => console.log(`Failed to clean up ${attachment.path}: ${err.message}`));
                console.log(`Cleaned up ${attachment.path}`);
            }
        } catch (error) {
            console.log(`Error in pinterest command: ${error.message}`);
            api.sendMessage(`${config.bot.botName}: ❌ Failed to fetch images: ${error.message}`, threadID, messageID);
        }
    }
};