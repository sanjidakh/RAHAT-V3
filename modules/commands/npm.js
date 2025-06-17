const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
// ==========================

module.exports = {
    name: "npm",
    version: "1.0.0",
    author: "Hridoy",
    description: "View details of an npm package in ASCII format 📦",
    adminOnly: false,
    commandCategory: "Utility",
    guide: "Use {pn}npm <package_name> to view details of an npm package.\nExample: {pn}npm express",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in npm command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

         
            const packageName = args.join(' ').trim().toLowerCase();
            if (!packageName) {
                logger.warn("No package name provided");
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: Please provide a package name. Example: {pn}npm express`,
                    threadID,
                    messageID
                );
            }

            logger.info(`Received command: .npm ${packageName} in thread ${threadID}`);

        
            const npmUrl = `${NPM_REGISTRY_URL}/${encodeURIComponent(packageName)}`;
            logger.info(`Fetching package details from: ${npmUrl}`);
            const response = await axios.get(npmUrl, { timeout: 10000 });

        
            if (response.status !== 200 || !response.data) {
                throw new Error("Package not found in the npm registry");
            }

            const packageData = response.data;
            const latestVersion = packageData['dist-tags']?.latest || 'N/A';
            const packageInfo = {
                name: packageData.name || packageName,
                version: latestVersion,
                description: packageData.description || 'No description available',
                author: packageData.author?.name || (packageData.maintainers?.[0]?.name) || 'Unknown',
                license: packageData.license || 'Not specified',
                homepage: packageData.homepage || 'Not available',
                repository: packageData.repository?.url?.replace('git+', '').replace('.git', '') || 'Not available',
                lastPublished: packageData.time?.[latestVersion] ? new Date(packageData.time[latestVersion]).toISOString().split('T')[0] : 'Unknown'
            };

           
            const asciiDetails = [
                "╔════════════════════════════════════╗",
                `║ 📦 npm Package Details: ${packageInfo.name.padEnd(15)} ║`,
                "╠════════════════════════════════════╣",
                `║ Name: ${packageInfo.name.padEnd(28)} ║`,
                `║ Version: ${packageInfo.version.padEnd(25)} ║`,
                `║ Description: ${packageInfo.description.padEnd(20)} ║`,
                `║ Author: ${packageInfo.author.padEnd(26)} ║`,
                `║ License: ${packageInfo.license.padEnd(25)} ║`,
                `║ Homepage: ${packageInfo.homepage.padEnd(23)} ║`,
                `║ Repository: ${packageInfo.repository.padEnd(21)} ║`,
                `║ Last Published: ${packageInfo.lastPublished.padEnd(18)} ║`,
                "╚════════════════════════════════════╝"
            ].join('\n');

        
            const senderInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            const userName = senderInfo[senderID]?.name || "Unknown User";

         
            const msg = {
                body: `${config.bot.botName}:\n${asciiDetails}`
            };

            logger.info(`Sending npm package details for: ${packageName}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("📦", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("npm package details sent successfully");

            logger.info(`[Npm Command] Fetched details for "${packageName}" for ${userName}`);
        } catch (err) {
            logger.error(`Error in npm command: ${err.message}`, { stack: err.stack });

      
            api.setMessageReaction("❌", messageID, () => {}, true);
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );
        }
    }
};