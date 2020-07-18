const express = require('express');
const helmet = require('helmet');
const Joi = require('@hapi/joi');

const schema = require('./middleware/schema.middleware.js');

const compile = require('./services/compilation.service');

const CompilationError = require('./errors/CompilationError');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(helmet());

app.use((err, req, res, next) => {
  console.error(err);
  let error = 'Unknown error.';

  switch (err.type) {
    case "entity.parse.failed":
      error = 'Malformed syntax.';
      break;
  }

  res.status(err.status).json({
    success: false,
    error,
  });
})

/**
 * @param {{[file: string]: string}} files 
 * @param {string} entrypoint 
 * @param {boolean} run 
 * @param {string} stdin 
 * @returns {import('express').RequestHandler} 
 */
const compile_action = (run = false) => async (req, res) => {
  const { files, entrypoint, args = [], stdin = null } = req.body;

  try {
    const result = await compile(files, entrypoint, true, args, stdin);

    res.json({
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (e) {
    if (e instanceof CompilationError) {
      res.json({
        success: false,
        error: {
          killed: e.error.killed,
          code: e.error.code,
          signal: e.error.signal,
        },
        stdout: e.stdout,
        stderr: e.stderr,
      });
    } else if (e instanceof Error) {
      res.json({
        success: false,
        error: e.message,
      });
    }
  }
}

app.post(
  '/run',
  schema({
    body: Joi.object({
      files: Joi.object().pattern(Joi.string().max(256), Joi.string().allow('')),
      entrypoint: Joi.string().max(256).default('main.sn'),
      args: Joi.array().items(Joi.string()),
      stdin: Joi.string(),
    }),
  }),
  compile_action(true)
);

app.post(
  '/build',
  schema({
    body: Joi.object({
      files: Joi.object().pattern(Joi.string().max(256), Joi.string().allow('')),
      entrypoint: Joi.string().max(256).default('main.sn'),
    }),
  }),
  compile_action(false)
);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
