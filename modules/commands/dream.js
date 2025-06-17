const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

module.exports = {
    name: "dream",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate AI images based on a user prompt and convert to PNG.",
    adminOnly: false,
    commandCategory: "AI",
    guide: "{pn}dream <prompt> - Generate AI images with the given prompt (e.g., .dream futuristic city).",
    cooldowns: 10,
    usePrefix: true,

    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const args = event.body.split(' ').slice(1);
        const prefix = config.prefix || ".";

        if (!args[0]) {
            return api.sendMessage(`${config.bot.botName}: ❌ Please provide a prompt (e.g., ${prefix}dream futuristic city).`, threadID, messageID);
        }

        const prompt = args.join(' ');
        console.log(`Generating AI images for prompt: ${prompt}`);

        try {
            const apiUrl = `https://nexalo-api.vercel.app/api/dream?prompt=${encodeURIComponent(prompt)}`;
            console.log(`Sending request to ${apiUrl}`);

            const response = await axios.get(apiUrl, { timeout: 10000 });
            const data = response.data;
            console.log(`API response received: ${JSON.stringify(data)}`);

            if (!data.response || !Array.isArray(data.response) || data.response.length === 0) {
                return api.sendMessage(`${config.bot.botName}: ❌ No images generated for "${prompt}".`, threadID, messageID);
            }

            const tempDir = path.join(__dirname, '../../temp');
            await fs.ensureDir(tempDir);

            const imageUrls = data.response;
            const webpFilePaths = [];
            const pngFilePaths = [];

            await Promise.all(imageUrls.map(async (url, index) => {
                const webpFileName = `dream_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}.webp`;
                const webpFilePath = path.join(tempDir, webpFileName);
                console.log(`Downloading WebP image from ${url} to ${webpFilePath}`);

                const imageResponse = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
                await fs.writeFile(webpFilePath, imageResponse.data);
                console.log(`WebP image saved: ${webpFilePath}`);

                const pngFileName = `dream_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}.png`;
                const pngFilePath = path.join(tempDir, pngFileName);
                await sharp(webpFilePath).toFormat('png').toFile(pngFilePath);
                console.log(`Converted to PNG: ${pngFilePath}`);

                webpFilePaths.push(webpFilePath);
                pngFilePaths.push(pngFilePath);

                await fs.unlink(webpFilePath).catch(err => console.log(`Failed to clean up WebP ${webpFilePath}: ${err.message}`));
                console.log(`Cleaned up WebP file: ${webpFilePath}`);
            }));

            const attachments = pngFilePaths.map(filePath => fs.createReadStream(filePath));
            console.log(`Attachments prepared: ${attachments.length} PNG files`);

            const msg = {
                body: `${config.bot.botName}: 🌌 Generated ${imageUrls.length} AI images for "${prompt}"!`,
                attachment: attachments
            };

            await api.sendMessage(msg, threadID, messageID);
            console.log(`Sent ${imageUrls.length} PNG images to thread ${threadID}`);

            await Promise.all(pngFilePaths.map(filePath => fs.unlink(filePath).catch(err => console.log(`Failed to clean up PNG ${filePath}: ${err.message}`))));
            console.log(`Cleaned up ${pngFilePaths.length} PNG temp files`);

            await Promise.all(webpFilePaths.map(filePath => {
                if (fs.existsSync(filePath)) {
                    return fs.unlink(filePath).catch(err => console.log(`Failed to clean up leftover WebP ${filePath}: ${err.message}`));
                }
            }));
            console.log(`Verified cleanup of WebP files`);
        } catch (error) {
            console.log(`Error in dream command: ${error.message}`);
            api.sendMessage(`${config.bot.botName}: ❌ Failed to generate images: ${error.message}`, threadID, messageID);
        }
    }
};