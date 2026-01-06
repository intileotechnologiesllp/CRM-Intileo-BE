'use strict';

/**
 * Creates multi-tenant chatbot tables:
 * - tenants: isolates each SaaS customer
 * - tenant_users: roles for chatbot administration (kept lean; can map to master users)
 * - chatbot_configs: runtime bot + channel config per tenant
 * - knowledge_bases: FAQ/KB entries scoped by tenant
 * - chat_sessions: tracks Chatwoot conversation ↔ Botpress session
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('tenants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'suspended'),
        allowNull: false,
        defaultValue: 'active',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.createTable('tenant_users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('owner', 'admin', 'agent'),
        allowNull: false,
        defaultValue: 'admin',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('tenant_users', ['tenantId']);

    await queryInterface.createTable('chatbot_configs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      botName: { type: Sequelize.STRING, allowNull: false },
      systemPrompt: { type: Sequelize.TEXT, allowNull: true },
      welcomeMessage: { type: Sequelize.TEXT, allowNull: true },
      language: { type: Sequelize.STRING, allowNull: true },
      businessHours: { type: Sequelize.JSON, allowNull: true },
      fallbackMessage: { type: Sequelize.TEXT, allowNull: true },
      enableHumanHandoff: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      allowedActions: { type: Sequelize.JSON, allowNull: true },
      escalationRules: { type: Sequelize.JSON, allowNull: true },
      botpressBotId: { type: Sequelize.STRING, allowNull: true },
      chatwootInboxId: { type: Sequelize.STRING, allowNull: true },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('chatbot_configs', ['tenantId']);
    await queryInterface.addIndex('chatbot_configs', ['chatwootInboxId']);

    await queryInterface.createTable('knowledge_bases', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      question: { type: Sequelize.TEXT, allowNull: false },
      answer: { type: Sequelize.TEXT, allowNull: false },
      tags: { type: Sequelize.JSON, allowNull: true },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('knowledge_bases', ['tenantId']);

    await queryInterface.createTable('chat_sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      chatwootConversationId: { type: Sequelize.STRING, allowNull: false },
      botpressSessionId: { type: Sequelize.STRING, allowNull: true },
      status: {
        type: Sequelize.ENUM('active', 'closed', 'handoff'),
        allowNull: false,
        defaultValue: 'active',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('chat_sessions', ['tenantId']);
    await queryInterface.addIndex('chat_sessions', ['chatwootConversationId']);
    await queryInterface.addIndex('chat_sessions', ['botpressSessionId']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('chat_sessions');
    await queryInterface.dropTable('knowledge_bases');
    await queryInterface.dropTable('chatbot_configs');
    await queryInterface.dropTable('tenant_users');
    await queryInterface.dropTable('tenants');
  },
};
