#!/usr/bin/env node

const { execSync } = require("child_process");

const args = process.argv.slice(2);
const command = args[0];

function execCommand(cmd) {
  try {
    console.log(`🔄 Executing: ${cmd}`);
    const result = execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
    return result;
  } catch (error) {
    console.error(`❌ Command failed: ${cmd}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
📧 EMAIL WORKERS MANAGEMENT SCRIPT

Usage: node scripts/manage-workers.js <command>

Commands:
  start          - Start all email workers
  start-inbox    - Start only inbox workers
  start-cron     - Start only cron workers  
  start-sync     - Start only sync workers
  stop           - Stop all email workers
  restart        - Restart all email workers
  status         - Show worker status
  logs           - Show all worker logs
  logs-inbox     - Show inbox worker logs
  logs-cron      - Show cron worker logs
  logs-sync      - Show sync worker logs
  monitor        - Open PM2 monitor dashboard
  help           - Show this help message

Examples:
  node scripts/manage-workers.js start
  node scripts/manage-workers.js logs-inbox
  node scripts/manage-workers.js status
`);
}

switch (command) {
  case "start":
    execCommand("pm2 start ecosystem.config.js");
    console.log("✅ All email workers started");
    break;

  case "start-inbox":
    execCommand("pm2 start ecosystem.config.js --only email-inbox-workers");
    console.log("✅ Inbox workers started");
    break;

  case "start-cron":
    execCommand("pm2 start ecosystem.config.js --only email-cron-workers");
    console.log("✅ Cron workers started");
    break;

  case "start-sync":
    execCommand("pm2 start ecosystem.config.js --only email-sync-workers");
    console.log("✅ Sync workers started");
    break;

  case "stop":
    execCommand("pm2 stop ecosystem.config.js");
    console.log("✅ All email workers stopped");
    break;

  case "restart":
    execCommand("pm2 restart ecosystem.config.js");
    console.log("✅ All email workers restarted");
    break;

  case "status":
    execCommand("pm2 list");
    break;

  case "logs":
    execCommand("pm2 logs");
    break;

  case "logs-inbox":
    execCommand("pm2 logs email-inbox-workers");
    break;

  case "logs-cron":
    execCommand("pm2 logs email-cron-workers");
    break;

  case "logs-sync":
    execCommand("pm2 logs email-sync-workers");
    break;

  case "monitor":
    execCommand("pm2 monit");
    break;

  case "help":
  default:
    showHelp();
    break;
}
