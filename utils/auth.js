const fs = require('fs');
const login = require('priyanshu-fca');
const logger = require('../includes/logger');

async function authenticate() {
  let appState;
  try {
    appState = JSON.parse(fs.readFileSync('appstate.json', 'utf8'));
  } catch (err) {
    logger.error(`Failed to load appstate.json: ${err.message}`);
    throw err;
  }

  return new Promise((resolve, reject) => {
    login({ appState }, (err, api) => {
      if (err) {
        logger.error(`Login failed: ${err.message}`);
        reject(err);
        return;
      }
      logger.info('Authenticated successfully');
      resolve(api);
    });
  });
}

module.exports = { authenticate };