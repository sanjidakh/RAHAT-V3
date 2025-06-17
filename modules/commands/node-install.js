const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../../includes/logger');
const execSync = require('child_process').execSync;
const config = require('../../config/config.json');

const sep = path.sep;

const defaultWriteFileSync = fs.writeFileSync;
const defaultCopyFileSync = fs.copyFileSync;

function checkAndAutoCreateFolder(pathFolder) {
    const splitPath = path.normalize(pathFolder).split(sep);
    let currentPath = '';
    for (const i in splitPath) {
        currentPath += splitPath[i] + sep;
        if (!fs.existsSync(currentPath))
            fs.mkdirSync(currentPath);
    }
}

fs.writeFileSync = function (fullPath, data) {
    fullPath = path.normalize(fullPath);
    const pathFolder = fullPath.split(sep);
    if (pathFolder.length > 1) pathFolder.pop();
    checkAndAutoCreateFolder(pathFolder.join(path.sep));
    defaultWriteFileSync(fullPath, data);
};

fs.copyFileSync = function (src, dest) {
    src = path.normalize(src);
    dest = path.normalize(dest);
    const pathFolder = dest.split(sep);
    if (pathFolder.length > 1) pathFolder.pop();
    checkAndAutoCreateFolder(pathFolder.join(path.sep));
    defaultCopyFileSync(src, dest);
};

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(fullPath));
        } else {
            results.push(fullPath);
        }
    });
    return results;
}

module.exports = {
    name: "node_install",
    version: "1.0.0",
    author: "Hridoy",
    description: "Install the latest update for the chatbot from GitHub.",
    adminOnly: true,
    commandCategory: "System",
    guide: "Type {pn}installupdate to install the update after checking with {pn}checkupdate.",
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
     
            const updateData = await getStoredUpdateData(api, threadID);
            if (!updateData || !updateData.remoteVersion || !updateData.newVersions || !updateData.currentVersion) {
                logger.info(`No update data found in thread history.`);
                return api.sendMessage(`${config.bot.botName}: ❌ No update data found. Please run ${prefix}checkupdate first.`, threadID, messageID);
            }

            logger.info(`Update data retrieved: ${JSON.stringify(updateData)}`);
            await handleUpdate({ api, threadID, messageID, ...updateData });
        } catch (err) {
            logger.error(`Error in installupdate command: ${err.message}`);
            await api.sendMessage(`${config.bot.botName}: ❌ Failed to install update: ${err.message}`, threadID);
            await api.setMessageReaction(":thumbsdown:", messageID);
        }
    }
};

async function getStoredUpdateData(api, threadID) {
    try {
        const messages = await api.getThreadHistory(threadID, 10);
        const dataMessage = messages.find(m => m.body && m.body.startsWith('{'));
        if (dataMessage) {
            logger.info(`Data message found: ${dataMessage.body}`);
            return JSON.parse(dataMessage.body);
        }
        logger.info(`No data message found in thread history: ${JSON.stringify(messages.map(m => m.body))}`);
        return null;
    } catch (err) {
        logger.error(`Error fetching update data: ${err.message}`);
        return null;
    }
}


async function fetchWithRetry(url, options, retries = 3, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.get(url, options);
        } catch (e) {
            if (e.response && e.response.status === 403 && i < retries - 1) {
                logger.info(`403 Forbidden on attempt ${i + 1}, retrying after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw e;
        }
    }
}

async function handleUpdate({ api, threadID, messageID, remoteVersion, newVersions, currentVersion }) {
    try {
        const repoUrl = "https://github.com/1dev-hridoy/NexaSim-v2";
        const headers = { 'User-Agent': 'NexaSim-Bot/1.0.0' }; 

        const { data: lastCommit } = await fetchWithRetry(`${repoUrl.replace('github.com', 'api.github.com/repos')}/commits/main`, { headers });
        const lastCommitDate = new Date(lastCommit.commit.committer.date);
        if (new Date().getTime() - lastCommitDate.getTime() < 5 * 60 * 1000) {
            const minutes = Math.floor((new Date().getTime() - lastCommitDate.getTime()) / 1000 / 60);
            const seconds = Math.floor((new Date().getTime() - lastCommitDate.getTime()) / 1000 % 60);
            const minutesCooldown = Math.floor((5 * 60 * 1000 - (new Date().getTime() - lastCommitDate.getTime())) / 1000 / 60);
            const secondsCooldown = Math.floor((5 * 60 * 1000 - (new Date().getTime() - lastCommitDate.getTime())) / 1000 % 60);
            await api.sendMessage(`${config.bot.botName}: ⭕ Last update was ${minutes} minutes ${seconds} seconds ago. Try again in ${minutesCooldown} minutes ${secondsCooldown} seconds.`, threadID, messageID);
            await api.setMessageReaction(":thumbsdown:", messageID);
            return;
        }

        await api.sendMessage(`${config.bot.botName}: Creating backup...`, threadID, messageID);
        const backupsPath = path.join(process.cwd(), 'backups');
        await fs.mkdir(backupsPath, { recursive: true });
        const folderBackup = path.join(backupsPath, `backup_${currentVersion}`);

        const filesToBackup = walkDir(process.cwd())
            .filter(file => !file.includes('appstate.json') && !file.includes('node_modules') && !file.includes('backups'))
            .map(file => path.relative(process.cwd(), file));

        for (const file of filesToBackup) {
            const src = path.join(process.cwd(), file);
            const dest = path.join(folderBackup, file);
            await fs.copy(src, dest, { overwrite: true, filter: src => !src.includes('appstate.json') });
        }

        await api.sendMessage(`${config.bot.botName}: Applying updates...`, threadID, messageID);
        const createUpdate = {
            version: "",
            files: {},
            deleteFiles: {},
            reinstallDependencies: false
        };

        for (const version of newVersions) {
            for (const filePath in version.files) {
                if (filePath === "config.json") {
                    if (!createUpdate.files[filePath])
                        createUpdate.files[filePath] = {};
                    createUpdate.files[filePath] = {
                        ...createUpdate.files[filePath],
                        ...version.files[filePath]
                    };
                } else {
                    createUpdate.files[filePath] = version.files[filePath];
                }

                if (version.reinstallDependencies)
                    createUpdate.reinstallDependencies = true;

                if (createUpdate.deleteFiles[filePath])
                    delete createUpdate.deleteFiles[filePath];

                for (const delFilePath in version.deleteFiles)
                    createUpdate.deleteFiles[delFilePath] = version.deleteFiles[delFilePath];

                createUpdate.version = version.version;
            }
        }

        for (const filePath in createUpdate.files) {
            const fullPath = path.join(process.cwd(), filePath);
            let getFile;
            try {
                logger.info(`Attempting to download ${repoUrl}/raw/main/${filePath}`);
                const response = await fetchWithRetry(`${repoUrl}/raw/main/${filePath}`, { responseType: 'arraybuffer', headers });
                getFile = response.data;
            } catch (e) {
                if (e.response && e.response.status === 403) {
                    logger.error(`403 Forbidden: Access to ${filePath} denied. Likely due to GitHub rate limits or repository restrictions.`);
                    await api.sendMessage(`${config.bot.botName}: ❌ 403 Forbidden: Update failed. GitHub rate limit exceeded or repository access restricted. Wait 1 hour for rate limits to reset or ensure the repository https://github.com/1dev-hridoy/NexaSim-v2 is fully public, then retry.`, threadID, messageID);
                    return;
                }
                logger.error(`Failed to download ${filePath}: ${e.message}`);
                continue;
            }

            if (filePath === "config.json") {
                const currentConfig = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
                const configUpdates = createUpdate.files[filePath];

                for (const key in configUpdates) {
                    const value = configUpdates[key];
                    if (typeof value === "string" && value.startsWith("DEFAULT_")) {
                        const keyOfDefault = value.replace("DEFAULT_", "");
                        currentConfig[key] = currentConfig[keyOfDefault] || currentConfig[key];
                    } else {
                        currentConfig[key] = value;
                    }
                }

                await fs.copy(fullPath, path.join(folderBackup, filePath));
                await fs.writeFile(fullPath, JSON.stringify(currentConfig, null, 2));
                logger.info(`Updated config.json`);
            } else {
                const contentsSkip = ["DO NOT UPDATE", "SKIP UPDATE", "DO NOT UPDATE THIS FILE"];
                const fileExists = fs.existsSync(fullPath);

                if (fileExists)
                    await fs.copy(fullPath, path.join(folderBackup, filePath));

                const firstLine = fileExists ? fs.readFileSync(fullPath, "utf-8").trim().split(/\r?\n|\r/)[0] : "";
                if (contentsSkip.some(c => firstLine.includes(c))) {
                    logger.info(`Skipped update for ${filePath} due to skip instruction`);
                    continue;
                }

                await fs.writeFile(fullPath, Buffer.from(getFile));
                logger.info(`${fileExists ? 'Updated' : 'Added'} ${filePath}`);
            }
        }

        for (const filePath in createUpdate.deleteFiles) {
            const fullPath = path.join(process.cwd(), filePath);
            if (fs.existsSync(fullPath)) {
                if (fs.lstatSync(fullPath).isDirectory())
                    await fs.remove(fullPath);
                else {
                    await fs.copy(fullPath, path.join(folderBackup, filePath));
                    await fs.unlink(fullPath);
                }
                logger.info(`Deleted ${filePath}`);
            }
        }

        const { data: remotePackage } = await fetchWithRetry(`${repoUrl}/raw/main/package.json`, { headers });
        await fs.writeFile(path.join(process.cwd(), 'package.json'), JSON.stringify(remotePackage, null, 2));


        const versionsPath = path.join(process.cwd(), 'versions.json');
        let versions = [];
        if (fs.existsSync(versionsPath)) {
            versions = JSON.parse(fs.readFileSync(versionsPath, 'utf-8'));
        }
      
        if (!versions.some(v => v.version === createUpdate.version)) {
            versions.push({
                version: createUpdate.version,
                files: createUpdate.files,
                deleteFiles: createUpdate.deleteFiles,
                reinstallDependencies: createUpdate.reinstallDependencies
            });
            await fs.writeFile(versionsPath, JSON.stringify(versions, null, 2));
            logger.info(`Updated versions.json with version ${createUpdate.version}`);
        }

        if (createUpdate.reinstallDependencies) {
            await api.sendMessage(`${config.bot.botName}: Installing dependencies...`, threadID, messageID);
            execSync('npm install', { stdio: 'inherit' });
        }


        await api.sendMessage(`${config.bot.botName}: Update to v${createUpdate.version} complete. Please restart the bot manually using 'pm2 restart bot' to apply the changes.`, threadID, messageID);
        await api.setMessageReaction(":thumbsup:", messageID);
    } catch (err) {
        logger.error(`Update failed: ${err.message}`);
        await api.sendMessage(`${config.bot.botName}: ❌ Update failed: ${err.message}`, threadID, messageID);
        await api.setMessageReaction(":thumbsdown:", messageID);
    }
}