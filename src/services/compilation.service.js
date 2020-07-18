const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

const child_process = require('child_process');

const utils = require('../utils');

const CompilationError = require('../errors/CompilationError');

/**
 * 
 * @param {string} file 
 * @param {...string} args 
 * @returns {Promise<{ error: import('child_process').ExecException, stdout: string, stderr: string }>}
 */
function exec(...args) {
  return new Promise(resolve => {
    child_process.exec(args.join(' '), {
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

/**
 * @param {string} arg 
 */
function normalize_arg(arg) {
  if (!/^".*?"$/.test(arg) && !/^'.*?'$/.test(arg)) {
    return `"${unescape(arg.replace(/"/g, '\\"'))}"`;
  }

  return unescape(arg);
}

/**
 * @param {{[file: string]: string}} files 
 * @param {string} entrypoint 
 * @param {boolean} run 
 * @param {string[]} args 
 * @param {string} stdin 
 * @returns {Promise<{ error: import('child_process').ExecException, stdout: string, stderr: string }>}
 */
module.exports = async (files, entrypoint, run = false, args = [], stdin = null) => {
  const id = uuidv4();
  const directory = path.resolve('tmp', id);

  const created_files = [];
  const wipe_files = () => Promise.all(created_files.map(file => fs.unlink(file)));

  const clean = async () => {
    await wipe_files();

    if (await utils.file_exists(directory)) {
      await fs.rmdir(directory, { recursive: true });
    }
  }

  try {
    /** @type {{[key: string]: string}} */
    const path_map = Object.keys(files).reduce((acc, file) => ({
      ...acc,
      [file]: path.join(directory, file),
    }), {});

    for (const key in path_map) {
      const is_root = path_map[key] === directory || path_map[key] === `${directory}/`;

      if (!utils.is_valid_path(path_map[key]) || !path_map[key].startsWith(`${directory}/`) || is_root) {
        throw new Error(`Filename '${key}' is not a valid path.`);
      }
    }

    const entrypoint_passed = Object.keys(files).some(file => file === entrypoint);

    if (!entrypoint_passed) {
      throw new Error(`Entrypoint ${entrypoint} not found in files.`);
    }

    await fs.mkdir(directory, { recursive: true });

    for (const filename in path_map) {
      const filepath = path_map[filename];

      const fullpath = path.resolve(directory, filepath);

      await fs.mkdir(path.dirname(fullpath), { recursive: true });
      await fs.writeFile(fullpath, files[filename]);

      created_files.push(fullpath);
    }

    const entrypoint_fullpath = path.resolve(directory, entrypoint);
    const executable_fullpath = path.resolve(directory, `__${id}`);

    const compilation = await exec_san('build', '-o', executable_fullpath, entrypoint_fullpath);

    if (compilation.error || compilation.stdout) {
      throw new CompilationError(compilation.error, compilation.stdout, compilation.stderr)
    }

    created_files.push(executable_fullpath);

    if (!run) {
      await clean();

      return {
        stdout: compilation.stdout,
        stderr: compilation.stderr,
      };
    } else {
      const echo = [];

      if (stdin) {
        echo.push('echo');
        echo.push(normalize_arg(stdin));
        echo.push('|');
      }

      const normalized_args = args.map(normalize_arg);
      const execution = await exec(...echo, executable_fullpath, ...normalized_args);

      if (execution.error) {
        throw new CompilationError(execution.error, execution.stdout, execution.stderr);
      }

      await clean();

      return {
        stdout: execution.stdout,
        stderr: execution.stderr,
      };
    }
  } catch (e) {
    await clean();
    throw e;
  }
}
