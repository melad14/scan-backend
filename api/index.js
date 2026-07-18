// Vercel serverless entry point
// app.js now handles DB connection middleware internally before routes2
const app = require('../src/app');

module.exports = app;
