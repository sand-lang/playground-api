const express = require('express');
const helmet = require('helmet');
const Joi = require('@hapi/joi');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const { execFile } = require('child_process');

const schema = require('./middleware/schema.middleware.js');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(helmet());

/**
 * @param {string} path 
 * @returns {boolean} 
 */
function is_valid_path(path) {
  return /^[\w\-. \/]+$/.test(path);
}

/**
 * 
 * @param {string} file 
 * @param {...string} args 
 * @returns {Promise<{ error: import('child_process').ExecException, stdout: string, stderr: string }>}
 */
function exec(file, ...args) {
  return new Promise(resolve => {
    execFile(file, args, {
      timeout: 25000,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      resolve({
        error,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * @param  {...string} args 
 */
function exec_san(...args) {
  return exec(path.resolve('san', 'bin', 'san'), ...args);
}

app.post(
  '/run',
  schema({
    body: Joi.object({
      files: Joi.object().pattern(Joi.string(), Joi.string().allow('').max(256)),
      stdin: Joi.string(),
      entrypoint: Joi.string().max(256).default('main.sn')
    }),
  }),
  async (req, res) => {
    const { files, stdin, entrypoint } = req.body;

    const id = uuidv4();
    const directory = path.resolve('tmp', id);

    /** @type {{[key: string]: string}} */
    const path_map = Object.keys(files).reduce((acc, file) => ({
      ...acc,
      [file]: path.join(directory, file),
    }), {});

    for (const key in path_map) {
      const is_root = path_map[key] === directory || path_map[key] === `${directory}/`;

      if (!is_valid_path(path_map[key]) || !path_map[key].startsWith(`${directory}/`) || is_root) {
        return res.json({
          success: false,
          error: `Filename '${key}' is not a valid path.`
        });
      }
    }

    const entrypoint_passed = Object.keys(files).some(file => file === entrypoint);

    if (!entrypoint_passed) {
      return res.json({
        success: false,
        error: `Entrypoint ${entrypoint} not found in files.`,
      });
    }

    await fs.mkdir(directory, { recursive: true });

    const created_files = [];
    const wipe_files = () => Promise.all(created_files.map(file => fs.unlink(file)));

    try {
      for (const filename in path_map) {
        const filepath = path_map[filename];

        const fullpath = path.resolve(directory, filepath);
        await fs.writeFile(fullpath, files[filename]);

        created_files.push(fullpath);
      }

      const entrypoint_fullpath = path.resolve(directory, entrypoint);
      const executable_fullpath = path.resolve(directory, `__${id}`);

      const compilation = await exec_san('build', '-o', executable_fullpath, entrypoint_fullpath);

      if (compilation.error || compilation.stdout) {
        res.json({
          sucess: false,
          ...compilation,
        });
      } else {
        created_files.push(executable_fullpath);

        const execution = await exec(executable_fullpath);

        res.json({
          sucess: !execution.error,
          ...execution,
        });
      }
    } catch (e) {
      console.error(e);

      res.json({
        success: false,
        error: 'An error occured.',
      });
    }

    try {
      await wipe_files();
      await fs.rmdir(directory);
    } catch (e) {
      console.error(e);
    }
  });

app.post('/build', (req, res) => {

});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
