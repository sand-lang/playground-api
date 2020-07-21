const cluster = require('cluster');
const cpus = require('os').cpus();

if (process.env.PRODUCTION && cluster.isMaster) {
  for (const _ in cpus) {
    cluster.fork();
  }
} else {
  require('./src/app.js')
}
