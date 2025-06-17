const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../../includes/logger');
const config = require('../../config/config.json');
const language = require(`../../languages/${config.language}.json`);

module.exports = {
    name: "update",
    version: "1.0.0",
    author: "Hridoy",
    description: "Check for updates for the chatbot from GitHub.",
    adminOnly: true,
    commandCategory: "System",
    guide: "Type {pn}checkupdate to check for updates.",
    cooldowns: 10,
    usePrefix: true,

    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const prefix = config.prefix || ".";

        if (!event || !threadID || !messageID) {
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
        }

        try {
            await api.setMessageReaction(":open_mouth:", messageID);
            const msgID = (await api.sendMessage(`${config.bot.botName}: Checking for updates...`, threadID)).messageID;

            const repoUrl = "https://github.com/1dev-hridoy/NexaSim-v2";
            const { data: remotePackage } = await axios.get(`${repoUrl}/raw/main/package.json`);
            logger.info(`Fetched remote version: ${remotePackage.version}`);
            const remoteVersion = remotePackage.version;
            const { data: versions } = await axios.get(`${repoUrl}/raw/main/versions.json`);
            logger.info(`Fetched versions: ${JSON.stringify(versions)}`);

            const projectRoot = path.resolve(__dirname, '../..');
            const packageJsonPath = path.join(projectRoot, 'package.json');
            logger.info(`Local package.json path: ${packageJsonPath}`);
            const currentVersion = require(packageJsonPath).version;
            logger.info(`Local version: ${currentVersion}`);

            if (compareVersion(remoteVersion, currentVersion) <= 0) {
                await api.editMessage(`${config.bot.botName}: ✅ You are using the latest version (v${currentVersion}).`, msgID);
                await api.setMessageReaction(":thumbsup:", messageID);
                return;
            }

            versions.sort((a, b) => compareVersion(a.version, b.version));
            const versionIndex = versions.findIndex(v => v.version === currentVersion);
            const newVersions = versionIndex < versions.length - 1 ? versions.slice(versionIndex + 1) : [];
            logger.info(`New versions to update: ${JSON.stringify(newVersions)}`);

            if (!newVersions.length) {
                await api.editMessage(`${config.bot.botName}: ✅ You are using the latest version (v${currentVersion}).`, msgID);
                await api.setMessageReaction(":thumbsup:", messageID);
                return;
            }

            let fileWillUpdate = [...new Set(newVersions.map(v => Object.keys(v.files || {})).flat())]
                .sort()
                .filter(f => f?.length);
            const totalUpdate = fileWillUpdate.length;
            fileWillUpdate = fileWillUpdate.slice(0, 10).map(file => ` - ${file}`).join("\n");

            let fileWillDelete = [...new Set(newVersions.map(v => Object.keys(v.deleteFiles || {}).flat()))]
                .sort()
                .filter(f => f?.length);
            const totalDelete = fileWillDelete.length;
            fileWillDelete = fileWillDelete.slice(0, 10).map(file => ` - ${file}`).join("\n");

            const promptMessage = `${config.bot.botName}: 💫 You are using version ${currentVersion}. A new version ${remoteVersion} is available.\n\n` +
                `⬆️ The following files will be updated:\n${fileWillUpdate}${totalUpdate > 10 ? `\n ...and ${totalUpdate - 10} more files` : ""}` +
                `${totalDelete > 0 ? `\n\n🗑️ The following files/folders will be deleted:\n${fileWillDelete}${totalDelete > 10 ? `\n ...and ${totalDelete - 10} more files` : ""}` : ""}` +
                `\n\nℹ️ See details at ${repoUrl}/commits/main\n📦 To install the update, type ${prefix}installupdate.`;

            await api.editMessage(promptMessage, msgID);

            const updateData = { remoteVersion, newVersions, currentVersion };
            const dataMsg = await api.sendMessage(JSON.stringify(updateData), threadID);
            logger.info(`Update data stored with message ID: ${dataMsg.messageID}`);
        } catch (err) {
            logger.error(`Error in checkupdate command: ${err.message}`);
            await api.sendMessage(`${config.bot.botName}: ❌ Failed to check updates: ${err.message}`, threadID);
            await api.setMessageReaction(":thumbsdown:", messageID);
        }
    }
};

function compareVersion(version1, version2) {
    logger.info(`Comparing versions: ${version1} vs ${version2}`);
    const v1 = version1.split(".");
    const v2 = version2.split(".");
    for (let i = 0; i < 3; i++) {
        if (parseInt(v1[i]) > parseInt(v2[i])) return 1;
        if (parseInt(v1[i]) < parseInt(v2[i])) return -1;
    }
    return 0;
}