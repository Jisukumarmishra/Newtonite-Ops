const app = require('./app');
const config = require('./config');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  Newtonite Ops - Operations Under Pressure           ║
║  Server running on port ${PORT}                         ║
║  Environment: ${config.nodeEnv.padEnd(38)}║
║  API Base: http://localhost:${PORT}/api                  ║
╚══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});
