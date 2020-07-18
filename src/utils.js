const fs = require('fs');

/**
 * @param {string} path 
 * @returns {boolean} 
 */
exports.is_valid_path = path => {
  return /^[\w\-. \/]+$/.test(path);
}

/**
 * @param {Promise<boolean>} path 
 */
exports.file_exists = path => {
  return new Promise(resolve => {
    fs.exists(path, resolve);
  });
}
