const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const { connect } = require('../../includes/database/index');

module.exports = {
    name: "warning",
    version: "1.0.0",
    author: "Hridoy",
    description: "Manages user warnings in a thread. Admins can add or remove warnings, and users are banned after 5 warnings.",
    adminOnly: false, 
    commandCategory: "admin",
    guide: "Use {pn}warning @username to add a warning (admin only)\n{pn}warning remove @username to remove a warning (admin only)\n{pn}warning list to view the warning list",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        try {
            if (!event || !event.threadID || !event.messageID) {
                logger.error("Invalid event object in warning command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
            }

            const db = await connect();
            const warningsCollection = db.collection('warnings');
            const threadID = event.threadID;
            const senderID = event.senderID;

       
            const adminIDs = config.bot.adminIDs || [];
            const threadInfo = await new Promise((resolve) => {
                api.getThreadInfo(threadID, (err, info) => resolve(err ? {} : info));
            });
            const groupAdmins = threadInfo.adminIDs ? threadInfo.adminIDs.map(admin => admin.id) : [];
            const isBotAdmin = adminIDs.includes(senderID);
            const isGroupAdmin = groupAdmins.includes(senderID);
            const isAdmin = isBotAdmin || isGroupAdmin;

       
            let threadWarnings = await warningsCollection.findOne({ threadID });
            if (!threadWarnings) {
                threadWarnings = {
                    threadID,
                    warnings: {} 
                };
                await warningsCollection.insertOne(threadWarnings);
            }

      
            if (args[0]?.toLowerCase() === "list") {
                const warnings = threadWarnings.warnings || {};
                if (Object.keys(warnings).length === 0) {
                    return api.sendMessage(`${config.bot.botName}: No warnings issued in this thread.`, threadID, event.messageID);
                }

                const userIDs = Object.keys(warnings);
                const warningDetails = await Promise.all(
                    userIDs.map(async (userID) => {
                        const userInfo = await new Promise((resolve) => {
                            api.getUserInfo(userID, (err, info) => resolve(err ? {} : info));
                        });
                        const userName = userInfo[userID]?.name || "Unknown User";
                        const warningCount = warnings[userID].count || 0;
                        return `${userName} (ID: ${userID}): ${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
                    })
                );

                return api.sendMessage(
                    `${config.bot.botName}: Warning List\n\n${warningDetails.join("\n")}`,
                    threadID,
                    event.messageID
                );
            } else if (args[0]?.toLowerCase() === "remove" && args[1] && event.mentions && Object.keys(event.mentions).length > 0) {
                if (!isAdmin) {
                    return api.sendMessage(
                        `${config.bot.botName}: ❌ Only bot admins or group admins can remove warnings.`,
                        threadID,
                        event.messageID
                    );
                }

                const mentionedUsers = Object.keys(event.mentions);
                if (mentionedUsers.length !== 1) {
                    return api.sendMessage(
                        `${config.bot.botName}: Please mention exactly one user to remove a warning.`,
                        threadID,
                        event.messageID
                    );
                }

                const targetID = mentionedUsers[0];
                const targetName = event.mentions[targetID] || "User";

                const userWarnings = threadWarnings.warnings[targetID];
                if (!userWarnings || userWarnings.count === 0) {
                    return api.sendMessage(
                        `${config.bot.botName}: ${targetName} has no warnings to remove.`,
                        threadID,
                        event.messageID
                    );
                }

       
                userWarnings.count -= 1;
                const adminInfo = await new Promise((resolve) => {
                    api.getUserInfo(senderID, (err, info) => resolve(err ? {} : info));
                });
                const adminName = adminInfo[senderID]?.name || "Admin";
                userWarnings.history = userWarnings.history || [];
                userWarnings.history.push({
                    action: "removed",
                    by: senderID,
                    timestamp: new Date().toISOString(),
                    remaining: userWarnings.count
                });

                if (userWarnings.count === 0) {
                    delete threadWarnings.warnings[targetID];
                } else {
                    threadWarnings.warnings[targetID] = userWarnings;
                }

                await warningsCollection.updateOne(
                    { threadID },
                    { $set: { warnings: threadWarnings.warnings } },
                    { upsert: true }
                );

                return api.sendMessage(
                    `${config.bot.botName}: ✅ Removed a warning from ${targetName}.\n` +
                    `New Warning Count: ${userWarnings.count}\n` +
                    `Action By: ${adminName}\n` +
                    `Timestamp: ${new Date().toISOString()}`,
                    threadID,
                    event.messageID
                );
            } else if (event.mentions && Object.keys(event.mentions).length > 0) {
                if (!isAdmin) {
                    return api.sendMessage(
                        `${config.bot.botName}: ❌ Only bot admins or group admins can add warnings.`,
                        threadID,
                        event.messageID
                    );
                }

                const mentionedUsers = Object.keys(event.mentions);
                if (mentionedUsers.length !== 1) {
                    return api.sendMessage(
                        `${config.bot.botName}: Please mention exactly one user to warn.`,
                        threadID,
                        event.messageID
                    );
                }

                const targetID = mentionedUsers[0];
                const targetName = event.mentions[targetID] || "User";


                if (!threadWarnings.warnings[targetID]) {
                    threadWarnings.warnings[targetID] = {
                        count: 0,
                        history: []
                    };
                }

                const userWarnings = threadWarnings.warnings[targetID];
                userWarnings.count += 1;
                const adminInfo = await new Promise((resolve) => {
                    api.getUserInfo(senderID, (err, info) => resolve(err ? {} : info));
                });
                const adminName = adminInfo[senderID]?.name || "Admin";
                userWarnings.history.push({
                    action: "added",
                    by: senderID,
                    timestamp: new Date().toISOString(),
                    newCount: userWarnings.count
                });

                threadWarnings.warnings[targetID] = userWarnings;

                await warningsCollection.updateOne(
                    { threadID },
                    { $set: { warnings: threadWarnings.warnings } },
                    { upsert: true }
                );

  
                if (userWarnings.count >= 5) {
                    try {
                        await new Promise((resolve, reject) => {
                            api.removeUserFromGroup(targetID, threadID, (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });
                        delete threadWarnings.warnings[targetID];
                        await warningsCollection.updateOne(
                            { threadID },
                            { $set: { warnings: threadWarnings.warnings } },
                            { upsert: true }
                        );
                        return api.sendMessage(
                            `${config.bot.botName}: 🚫 ${targetName} has been banned!\n` +
                            `Reason: Reached 5 warnings.\n` +
                            `Last Warning By: ${adminName}\n` +
                            `Timestamp: ${new Date().toISOString()}`,
                            threadID,
                            event.messageID
                        );
                    } catch (err) {
                        logger.error(`Failed to ban user ${targetID}: ${err.message}`);
                        return api.sendMessage(
                            `${config.bot.botName}: ⚠️ Warning added to ${targetName}, but failed to ban.\n` +
                            `Warning Count: ${userWarnings.count} (Ban threshold reached)\n` +
                            `Added By: ${adminName}\n` +
                            `Timestamp: ${new Date().toISOString()}\n` +
                            `Note: Please ban the user manually.`,
                            threadID,
                            event.messageID
                        );
                    }
                }

                return api.sendMessage(
                    `${config.bot.botName}: ⚠️ Warning added to ${targetName}.\n` +
                    `Warning Count: ${userWarnings.count}/5\n` +
                    `Added By: ${adminName}\n` +
                    `Timestamp: ${new Date().toISOString()}`,
                    threadID,
                    event.messageID
                );
            } else {
                return api.sendMessage(
                    `${config.bot.botName}: Invalid syntax. Usage:\n` +
                    `{pn}warning @username - Add a warning (admin only)\n` +
                    `{pn}warning remove @username - Remove a warning (admin only)\n` +
                    `{pn}warning list - View the warning list`,
                    threadID,
                    event.messageID
                );
            }
        } catch (error) {
            logger.error(`Error in warning execute: ${error.message}`, { event, args });
            try {
                await api.sendMessage(
                    `${config.bot.botName}: ❌ An error occurred while processing the warning command.`,
                    event.threadID,
                    event.messageID
                );
            } catch (sendErr) {
                logger.error(`Failed to send error message in execute: ${sendErr.message}`);
            }
        }
    }
};