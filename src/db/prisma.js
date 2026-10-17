const { PrismaClient } = require('@prisma/client');

let prisma;

// Singleton pattern: reuse the same PrismaClient instance
if (!prisma) {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

module.exports = prisma;
