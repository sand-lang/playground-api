class CompilationError extends Error {
  /**
   * @param {import('child_process').ExecException} error 
   * @param {string} stdout 
   * @param {string} stderr 
   */
  constructor(error, stdout, stderr) {
    super('Compilation error.');

    this.error = error;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

module.exports = CompilationError;
