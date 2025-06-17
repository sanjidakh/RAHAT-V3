const chalk = require('chalk');
const gradient = require('gradient-string');
const config = require('../config/config.json');

const logLevels = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  verbose: 4
};

const currentLevel = logLevels[config.logging.level] || logLevels.info;

const levelColors = {
  error: chalk.red.bold,
  warn: chalk.yellow.bold,
  info: chalk.cyan.bold,
  verbose: chalk.gray
};

const messageGradient = gradient(['#ff69b4', '#00ffff']);

function log(level, message) {
  if (logLevels[level] <= currentLevel) {
    const timestamp = new Date().toISOString();
    const levelText = levelColors[level](`[${level.toUpperCase()}]`);
    const formattedMessage = messageGradient(message);
    console.log(`${chalk.gray(`[${timestamp}]`)} ${levelText} ${formattedMessage}`);
  }
}

module.exports = {
  error: (message) => log('error', message),
  warn: (message) => log('warn', message),
  info: (message) => log('info', message),
  verbose: (message) => log('verbose', message)
};