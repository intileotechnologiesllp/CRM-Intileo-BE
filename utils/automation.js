/**
 * Pipedrive-like automation runner for Node.js + Express + Sequelize
 * - Supports: IF, SWITCH, ACTION (UPDATE_ENTITY, DELAY, STOP)
 * - Supports recursive/nested condition groups (AND/OR with subgroups)
 * - Supports templating: {{entity.field}}, {{event.path}}, {{now}}
 *
 * REFACTORED: Models passed as parameters instead of direct import
 * NOTE: This file appears to be example/draft code - not currently used in production
 */

const { sendEmail } = require("./emailSend");

// ------------------------------
// Helpers: safe path lookup + template
// ------------------------------
function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  console.log(obj, path, "GET BY PATH");
  return path
    .split(".")
    .reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function renderTemplateString(str, ctx) {
  if (typeof str !== "string") return str;
  return str.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr) => {
    const key = String(expr).trim();
    if (key === "now") return new Date().toISOString();

    if (key.startsWith("entity.")) {
      const v = getByPath(ctx.entity, key.slice("entity.".length));
      return v == null ? "" : String(v);
    }

    if (key.startsWith("event.")) {
      const v = getByPath(ctx.event, key.slice("event.".length));
      console.log(v == null ? "" : String(v), "RENDER TEMPLATE STRING");
      return v == null ? "" : String(v);
    }

    // allow raw paths too, like {{title}} meaning entity.title
    const v = getByPath(ctx.entity, key);
    return v == null ? "" : String(v);
  });
}

function deepRenderTemplates(value, ctx) {
  if (value == null) return value;
  if (typeof value === "string") return renderTemplateString(value, ctx);
  if (Array.isArray(value))
    return value.map((v) => deepRenderTemplates(v, ctx));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value))
      out[k] = deepRenderTemplates(v, ctx);
    return out;
  }
  return value;
}

// ------------------------------
// Condition evaluation (supports changed_to / changed_from)
// ------------------------------
function evalRule({ entity, event }, rule) {
  const field = rule.field;
  const op = rule.operator;
  const expected = rule.value;
  const actual = getByPath(entity, field);

  const before = getByPath(event, "data.before") || {};
  const after = getByPath(event, "data.after") || {};
  const changedFields = getByPath(event, "data.changedFields") || [];

  const toNum = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };

  console.log(op, actual, expected, "EVAL RULE");
  switch (op) {
    case "EQ":
    case "equals":
      return actual === expected;

    case "NEQ":
    case "not_equals":
      return actual !== expected;

    case "CONTAINS":
    case "contains":
      return actual != null && String(actual).includes(String(expected ?? ""));

    case "GT":
    case "greater_than": {
      const a = toNum(actual),
        b = toNum(expected);
      return a != null && b != null && a > b;
    }

    case "GTE":
    case "greater_or_equal": {
      const a = toNum(actual),
        b = toNum(expected);
      return a != null && b != null && a >= b;
    }

    case "LT":
    case "less_than": {
      const a = toNum(actual),
        b = toNum(expected);
      return a != null && b != null && a < b;
    }

    case "LTE":
    case "less_or_equal": {
      const a = toNum(actual),
        b = toNum(expected);
      return a != null && b != null && a <= b;
    }

    case "IS_EMPTY":
    case "is_empty":
      return actual == null || actual === "";

    case "IS_NOT_EMPTY":
    case "is_not_empty":
      return !(actual == null || actual === "");

    case "IN":
    case "in":
      return Array.isArray(expected) ? expected.includes(actual) : false;

    case "CHANGED":
    case "changed": {
      if (Array.isArray(changedFields) && changedFields.includes(field))
        return true;
      const b = getByPath(before, field);
      const a = getByPath(after, field);
      return b !== a;
    }

    case "CHANGED_TO":
    case "changed_to": {
      const b = getByPath(before, field);
      const a = getByPath(after, field);
      return b !== a && a === expected;
    }

    case "CHANGED_FROM":
    case "changed_from": {
      const b = getByPath(before, field);
      const a = getByPath(after, field);
      return b !== a && b === expected;
    }

    default:
      return false;
  }
}

// ConditionGroup format:
// { groupOperator: "AND"|"OR", rules: [rule], groups: [ConditionGroup] }
function evaluateConditionGroup(ctx, group) {
  if (!group) return true;

  const op = group.groupOperator || group.operator || "AND";
  const ruleResults = (group.rules || []).map((r) => evalRule(ctx, r));
  const groupResults = (group.groups || []).map((g) =>
    evaluateConditionGroup(ctx, g)
  );

  const results = [...ruleResults, ...groupResults];

  console.log(results, "EVALUATE CONDITION RESULTS");
  if (results.length === 0) return true;
  return op === "OR" ? results.some(Boolean) : results.every(Boolean);
}

// ------------------------------
// Node execution (ACTION / IF / SWITCH)
// ------------------------------
class StopFlow extends Error {
  constructor(reason) {
    super(reason || "STOP");
    this.name = "StopFlow";
    this.reason = reason || "STOP";
  }
}

async function runAutomationGraph({
  automation, // full automation JSON
  entity, // Sequelize instance OR plain object (Deal/Lead)
  event, // event payload
  models, // { Deal, Lead, ... }
  maxSteps = 1000,
  logger = console,
}) {
  if (!automation?.flow?.startNodeId)
    throw new Error("Invalid automation JSON: missing flow.startNodeId");

  const nodes = automation.flow.nodes || [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const ctx = {
    entity: entity?.toJSON ? entity.toJSON() : entity,
    event: event || {},
  };

  let currentId = automation.flow.startNodeId;
  let steps = 0;

  while (currentId) {
    if (++steps > maxSteps)
      throw new Error("Max steps exceeded (possible infinite loop)");

    const node = nodeMap.get(currentId);
    if (!node) throw new Error(`Node not found: ${currentId}`);

    logger.info(`[automation] node=${node.id} type=${node.type}`);

    if (node.type === "IF") {
      const passed = evaluateConditionGroup(
        { entity: ctx.entity, event: ctx.event },
        node.condition
      );
      console.log(passed, "IF NODE RESULT");
      currentId = passed ? node.trueNext : node.falseNext;
      continue;
    }

    if (node.type === "SWITCH") {
      const expr = renderTemplateString(String(node.expression ?? ""), ctx);
      // Try number if it's numeric
      const exprValue = /^[0-9]+$/.test(expr) ? Number(expr) : expr;

      const match = (node.cases || []).find((c) => c.equals === exprValue);
      currentId = match ? match.next : node.defaultNext;
      continue;
    }

    if (node.type === "ACTION") {
      const result = await executeActionNode({
        node,
        ctx,
        entity,
        models,
        logger,
      });
      // update ctx.entity if we updated the entity
      if (result?.updatedEntity) {
        entity = result.updatedEntity;
        ctx.entity = entity.toJSON ? entity.toJSON() : entity;
      }
      currentId = node.next || null;
      continue;
    }

    throw new Error(`Unsupported node type: ${node.type}`);
  }

  return { status: "COMPLETED" };
}

async function executeActionNode({ node, ctx, entity, models, logger }) {
  const action = node.action;
  if (!action?.type)
    throw new Error(`ACTION node missing action.type: ${node.id}`);

  // Render templates inside params
  const renderedParams = deepRenderTemplates(action.params || {}, ctx);
  console.log(renderedParams, "RENDERED PARAMS");
  console.log(action.entityType, action.type, "ACTIONS TYPES");
  switch (action.type) {
    case "STOP": {
      logger.info(`[automation] STOP: ${renderedParams.reason || ""}`);
      throw new StopFlow(renderedParams.reason);
    }

    case "DELAY": {
      // In real systems, you'd persist resumeAt to DB and return WAITING
      // Here, we'll just simulate by sleeping (NOT recommended for production)
      const minutes = Number(renderedParams.minutes || 0);
      const ms = Math.max(0, minutes) * 60_000;
      logger.info(`[automation] DELAY ${minutes} min (${ms} ms)`);
      await new Promise((r) => setTimeout(r, ms));
      return { delayed: true };
    }

    case "UPDATE_ENTITY": {
      const entityType = action.entityType;
      const fields = renderedParams.fields || {};

      if (!entityType)
        throw new Error(
          `UPDATE_ENTITY missing action.entityType (node=${node.id})`
        );

      if (entityType === "deal") {
        if (!models.Deal) throw new Error("Sequelize model Deal not provided");
        const pk = entity.dealId ?? entity.id;
        console.log("UPDATING DEAL", pk, fields);
        const updated = await models.Deal.update(fields, {
          where: { dealId: pk },
        });
        // reload
        const fresh = await models.Deal.findOne({ where: { dealId: pk } });
        // console.log("FETCHING DEAL", updated, fresh);
        return { updated, updatedEntity: fresh };
      }

      if (entityType === "lead") {
        if (!models.Lead) throw new Error("Sequelize model Lead not provided");
        const pk = entity.leadId ?? entity.id;
        const updated = await models.Lead.update(fields, {
          where: { leadId: pk },
        });
        const fresh = await models.Lead.findOne({ where: { leadId: pk } });
        return { updated, updatedEntity: fresh };
      }

      if (entityType === "activity") {
        if (!models.Lead) throw new Error("Sequelize model Lead not provided");
        const pk = entity.leadId ?? entity.id;
        const updated = await models.Activity.update(fields, {
          where: { activityId: pk },
        });
        const fresh = await models.Activity.findOne({
          where: { activityId: pk },
        });
        return { updated, updatedEntity: fresh };
      }
      if (entityType === "people") {
        if (!models.Lead) throw new Error("Sequelize model Lead not provided");
        const pk = entity.leadId ?? entity.id;
        const updated = await models.Activity.update(fields, {
          where: { activityId: pk },
        });
        const fresh = await models.Activity.findOne({
          where: { activityId: pk },
        });
        return { updated, updatedEntity: fresh };
      }
      if (entityType === "organization") {
        if (!models.Lead) throw new Error("Sequelize model Lead not provided");
        const pk = entity.leadId ?? entity.id;
        const updated = await models.Activity.update(fields, {
          where: { activityId: pk },
        });
        const fresh = await models.Activity.findOne({
          where: { activityId: pk },
        });
        return { updated, updatedEntity: fresh };
      }

      throw new Error(
        `Unsupported entityType for UPDATE_ENTITY: ${entityType}`
      );
    }

    case "CREATE_ENTITY": {
      const entityType = action.entityType;
      const fields = renderedParams.fields || {};
      if (!entityType)
        throw new Error(
          `CREATE_ENTITY missing action.entityType (node=${node.id})`
        );
      if (entityType === "deal") {
        if (!models.Deal) throw new Error("Sequelize model Deal not provided");
        const created = await models.Deal.create(fields);
        return { createdEntity: created };
      }
      if (entityType === "lead") {
        if (!models.Lead) throw new Error("Sequelize model Lead not provided");
        const created = await models.Lead.create(fields);
        return { createdEntity: created };
      }
      if (entityType === "activity") {
        if (!models.Activity)
          throw new Error("Sequelize model Activity not provided");
        const created = await models.Activity.create(fields);
        return { createdEntity: created };
      }
      throw new Error(
        `Unsupported entityType for CREATE_ENTITY: ${entityType}`
      );
    }

    case "DELETE_ENTITY": {
      const entityType = action.entityType;
      if (!entityType)
        throw new Error(
          `DELETE_ENTITY missing action.entityType (node=${node.id})`
        );
      if (entityType === "deal") {
        if (!models.Deal) throw new Error("Sequelize model Deal not provided");
        const pk = entity.dealId ?? entity.id;
        const deleted = await models.Deal.destroy({
          where: { dealId: pk },
        });
        return { deleted };
      }
      if (entityType === "lead") {
        if (!models.Lead) throw new Error("Sequelize model Lead not provided");
        const pk = entity.leadId ?? entity.id;
        const deleted = await models.Lead.destroy({
          where: { leadId: pk },
        });
        return { deleted };
      }
      throw new Error(
        `Unsupported entityType for DELETE_ENTITY: ${entityType}`
      );
    }
    case "SEND_EMAIL": {
      // Placeholder for SEND_EMAIL action
      logger.info(`[automation] SEND_EMAIL action not implemented yet`);
      await sendEmail(renderedParams.from, {
        from: renderedParams.from,
        to: renderedParams.to,
        subject: renderedParams.subject,
        text: renderedParams.body,
      })
      return {};
    }

    // You can expand here:
    // case "MOVE_STAGE":
    // case "CREATE_ACTIVITY":
    // case "WEBHOOK":
    // case "SEND_EMAIL":
    default:
      throw new Error(`Unsupported action.type: ${action.type}`);
  }
}

// ------------------------------
// Express route example
// ------------------------------
// POST /automation/run
// body: { automationJson, entityType, entityId, event }
function createAutomationRouter(models) {
  const express = require("express");
  const router = express.Router();

  router.post("/run", async (req, res) => {
    try {
      const { automationJson, entityType, entityId, event } = req.body;
      if (!automationJson)
        return res.status(400).json({ error: "automationJson is required" });
      if (!entityType || !["deal", "lead"].includes(entityType))
        return res.status(400).json({ error: "entityType must be deal|lead" });
      if (!entityId || typeof entityId !== "number")
        return res.status(400).json({ error: "entityId must be number" });

      let entity;
      if (entityType === "deal")
        entity = await models.Deal.findOne({ where: { dealId: entityId } });
      else entity = await models.Lead.findOne({ where: { leadId: entityId } });

      if (!entity) return res.status(404).json({ error: "Entity not found" });

      try {
        const result = await runAutomationGraph({
          automation: automationJson,
          entity,
          event: event || {},
          models,
        });
        return res.json(result);
      } catch (e) {
        if (e && e.name === "StopFlow") {
          return res.json({ status: "STOPPED", reason: e.reason });
        }
        throw e;
      }
    } catch (err) {
      return res.status(500).json({ error: String(err?.message || err) });
    }
  });

  return router;
}

const automationJson = {
  name: "Stage change routing + label",
  isEnabled: true,
  trigger: {
    type: "deal.stage_changed",
    entityType: "deal",
    when: "stage_changed",
    payloadMapping: {
      before: "event.data.before",
      after: "event.data.after",
      changedFields: "event.data.changedFields",
    },
  },
  flow: {
    version: 1,
    startNodeId: "node_if_stage5",
    nodes: [
      {
        id: "node_if_stage5",
        type: "IF",
        condition: {
          groupOperator: "AND",
          rules: [
            {
              field: "stageId",
              operator: "equals",
              value: 5,
              isDynamic: false,
            },
          ],
          groups: [],
        },
        trueNext: "node_if_high_value",
        falseNext: "node_default_branch",
      },

      {
        id: "node_if_high_value",
        type: "IF",
        condition: {
          groupOperator: "AND",
          rules: [{ field: "value", operator: "GT", value: 100000 }],
          groups: [],
        },
        trueNext: "node_action_hot",
        falseNext: "node_action_normal_then_stop",
      },

      {
        id: "node_action_hot",
        type: "ACTION",
        action: {
          type: "UPDATE_ENTITY",
          entityType: "deal",
          params: {
            fields: {
              label: "HOT (stage {{event.data.after.stageId}})",
              status: "Priority for {{entity.title}}",
              source: "automation",
              pipelineStage: "Proposal",
            },
          },
        },
        next: "node_delay_30",
      },

      {
        id: "node_action_normal_then_stop",
        type: "ACTION",
        action: {
          type: "UPDATE_ENTITY",
          entityType: "deal",
          params: {
            fields: {
              label: "Normal (stage {{event.data.after.stageId}})",
            },
          },
        },
        next: "node_stop_low_value",
      },

      {
        id: "node_stop_low_value",
        type: "ACTION",
        action: {
          type: "STOP",
          params: { reason: "Not high value, stop rest of flow" },
        },
      },

      {
        id: "node_default_branch",
        type: "ACTION",
        action: {
          type: "UPDATE_ENTITY",
          entityType: "deal",
          params: {
            fields: {
              label: "Normal (stage {{event.data.after.stageId}})",
            },
          },
        },
        next: "node_stop_default",
      },

      {
        id: "node_stop_default",
        type: "ACTION",
        action: {
          type: "STOP",
          params: { reason: "Stage not 5, end flow" },
        },
      },

      {
        id: "node_delay_30",
        type: "ACTION",
        action: {
          type: "DELAY",
          params: { minutes: 1 },
        },
        next: "node_followup_status",
      },

      {
        id: "node_followup_status",
        type: "ACTION",
        action: {
          type: "UPDATE_ENTITY",
          entityType: "deal",
          params: {
            fields: {
              status: "Follow-up after {{now}}",
            },
          },
        },
      },
    ],
  },
};

// runAutomationGraph({
//   automation: automationJson,
//   entity: { dealId: 352, stageId: 4, value: 150000, title: "Big Deal" },
//   event: {
//     data: {
//       before: { stageId: 4 },
//       after: { stageId: 5 },
//       changedFields: ["stageId"],
//     },
//   },
//   models: { Deal: Deal /* your Sequelize Deal model */ },
// }).then((result) => {
//   console.log("Automation run result:", result);
// });
