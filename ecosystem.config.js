module.exports = {
  apps: [
    {
      name: "email-inbox-workers",
      script: "./utils/emailQueueWorker.js",
      args: "--inbox",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--expose-gc", // Enable garbage collection
        // Database Configuration
        DB_NAME: "crm",
        DB_USER: "root",
        DB_PASSWORD: "mridul@123",
        DB_HOST: "localhost",
        DB_PORT: "3306",
        DB_DIALECT: "mysql",
        // RabbitMQ Configuration
        RABBITMQ_URL: "amqp://localhost:5672",
        // Application Configuration
        LOCALHOST_URL: "http://localhost:3056",
        PORT: "3056",
        // Email Configuration (if needed)
        EMAIL_USER: "mridulverma2533@gmail.com",
        EMAIL_PASS: "rbtb kmmo hjdk hbub",
        SENDER_EMAIL: "vermamridul641@gmail.com",
        SENDER_PASSWORD: "yktw lbwo hasg elei",
        FRONTEND_URL: "http://localhost:3056",
        SENDER_NAME: "Mridul verma",
        JWT_SECRET:
          "1d5d2abb3d7d78ed56d186b490a82267a88b5d3ddb3c8f3db9701310527b1be4a089cf8be2957576bb3b99bebbec00a18606d430ad954479e9c6012fd6bd346f",
      },
      log_file: "./logs/email-inbox-workers.log",
      out_file: "./logs/email-inbox-workers-out.log",
      error_file: "./logs/email-inbox-workers-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      kill_timeout: 5000,
      restart_delay: 2000,
    },
    {
      name: "email-cron-workers",
      script: "./utils/emailQueueWorker.js",
      args: "--cron",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--expose-gc", // Enable garbage collection
        // Database Configuration
        DB_NAME: "crm",
        DB_USER: "root",
        DB_PASSWORD: "mridul@123",
        DB_HOST: "localhost",
        DB_PORT: "3306",
        DB_DIALECT: "mysql",
        // RabbitMQ Configuration
        RABBITMQ_URL: "amqp://localhost:5672",
        // Application Configuration
        LOCALHOST_URL: "http://localhost:3056",
        PORT: "3056",
        // Email Configuration (if needed)
        EMAIL_USER: "mridulverma2533@gmail.com",
        EMAIL_PASS: "rbtb kmmo hjdk hbub",
        SENDER_EMAIL: "vermamridul641@gmail.com",
        SENDER_PASSWORD: "yktw lbwo hasg elei",
        FRONTEND_URL: "http://localhost:3056",
        SENDER_NAME: "Mridul verma",
        JWT_SECRET:
          "1d5d2abb3d7d78ed56d186b490a82267a88b5d3ddb3c8f3db9701310527b1be4a089cf8be2957576bb3b99bebbec00a18606d430ad954479e9c6012fd6bd346f",
      },
      log_file: "./logs/email-cron-workers.log",
      out_file: "./logs/email-cron-workers-out.log",
      error_file: "./logs/email-cron-workers-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      kill_timeout: 5000,
      restart_delay: 2000,
    },
    {
      name: "email-sync-workers",
      script: "./utils/emailQueueWorker.js",
      args: "--sync",
      instances: 1, // Single instance with internal parallelism
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--expose-gc",
        // Database Configuration
        DB_NAME: "crm",
        DB_USER: "root",
        DB_PASSWORD: "mridul@123",
        DB_HOST: "localhost",
        DB_PORT: "3306",
        DB_DIALECT: "mysql",
        // RabbitMQ Configuration
        RABBITMQ_URL: "amqp://localhost:5672",
        // Application Configuration
        LOCALHOST_URL: "http://localhost:3056",
        PORT: "3056",
        // Email Configuration (if needed)
        EMAIL_USER: "mridulverma2533@gmail.com",
        EMAIL_PASS: "rbtb kmmo hjdk hbub",
        SENDER_EMAIL: "vermamridul641@gmail.com",
        SENDER_PASSWORD: "yktw lbwo hasg elei",
        FRONTEND_URL: "http://localhost:3056",
        SENDER_NAME: "Mridul verma",
        JWT_SECRET:
          "1d5d2abb3d7d78ed56d186b490a82267a88b5d3ddb3c8f3db9701310527b1be4a089cf8be2957576bb3b99bebbec00a18606d430ad954479e9c6012fd6bd346f",
      },
      log_file: "./logs/email-sync-workers.log",
      out_file: "./logs/email-sync-workers-out.log",
      error_file: "./logs/email-sync-workers-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      kill_timeout: 5000,
      restart_delay: 2000,
    },
    {
      name: "email-scheduled-workers",
      script: "./utils/emailQueueWorker.js",
      args: "--scheduled",
      instances: 1, // Single instance with internal parallelism
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--expose-gc",
        // Database Configuration
        DB_NAME: "crm",
        DB_USER: "root",
        DB_PASSWORD: "mridul@123",
        DB_HOST: "localhost",
        DB_PORT: "3306",
        DB_DIALECT: "mysql",
        // RabbitMQ Configuration
        RABBITMQ_URL: "amqp://localhost:5672",
        // Application Configuration
        LOCALHOST_URL: "http://localhost:3056",
        PORT: "3056",
        // Email Configuration (if needed)
        EMAIL_USER: "mridulverma2533@gmail.com",
        EMAIL_PASS: "rbtb kmmo hjdk hbub",
        SENDER_EMAIL: "vermamridul641@gmail.com",
        SENDER_PASSWORD: "yktw lbwo hasg elei",
        FRONTEND_URL: "http://localhost:3056",
        SENDER_NAME: "Mridul verma",
        JWT_SECRET:
          "1d5d2abb3d7d78ed56d186b490a82267a88b5d3ddb3c8f3db9701310527b1be4a089cf8be2957576bb3b99bebbec00a18606d430ad954479e9c6012fd6bd346f",
      },
      log_file: "./logs/email-scheduled-workers.log",
      out_file: "./logs/email-scheduled-workers-out.log",
      error_file: "./logs/email-scheduled-workers-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      kill_timeout: 5000,
      restart_delay: 2000,
    },
  ],
};
