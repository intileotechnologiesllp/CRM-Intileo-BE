// merge.service.js
const sequelize = require("../../config/db.js");
const {
  Activity,
  Deal,
  Email,
  Lead,
  MergeMapModel,
  TagMapModel,
} = require("../../models/index.js");
// const { sequelize } = require("../db/sequelize.js");
// import { Deal, Lead, Note, Activity, Email, File, TagMap, MergeMap } from "../models/index.js";
// const MergeMap = MergeMapModel(sequelize);
// const TagMap = TagMapModel(sequelize);

// const RELATED_MODELS = [Activity, Email, File, TagMap, MergeMapModel];

function isEmpty(v) {
  return (
    v === null || v === undefined || (typeof v === "string" && v.trim() === "")
  );
}

function mergeFields(primary, secondary, strategy = "FILL_EMPTY") {
  if (strategy === "KEEP_PRIMARY") return primary;

  const merged = { ...primary };
  for (const [k, v] of Object.entries(secondary)) {
    if (["id", "createdAt", "updatedAt", "deletedAt", "deleted_at"].includes(k))
      continue;
    if (isEmpty(merged[k]) && !isEmpty(v)) merged[k] = v;
  }
  return merged;
}

exports.mergeEntitiesSequelize = ({
  entityType, // 'deal' | 'lead'
  primaryId,
  secondaryIds, // number[]
  strategy = "FILL_EMPTY",
  reason = null,
  mergedBy,
  Lead, Deal, Activity, Email, MergeMap, TagMap
}) => {
  try {
    console.log("HERE STEP 1")
    if (!Array.isArray(secondaryIds) || secondaryIds.length === 0) {
      throw new Error("secondaryIds is required");
    }
    if (secondaryIds.includes(primaryId)) {
      throw new Error("secondaryIds cannot include primaryId");
    }
  
    const Model = entityType === "deal" ? Deal : Lead;
    const id = entityType === "deal" ? "dealId" : "leadId";
    return sequelize.transaction(async (t) => {
      // 1) Lock primary row
      const primary = await Model.findOne({
        where: { [id]: primaryId },
        transaction: t,
        lock: t.LOCK.UPDATE,
        // if paranoid true, deleted rows are excluded automatically
      });
      if (!primary) throw new Error(`${entityType} primary not found`);
  
      // 2) Lock secondary rows
      const secondaries = await Model.findAll({
        where: { [id]: secondaryIds },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      
      console.log("HERE STEP 2",secondaries)
      if (secondaries.length !== secondaryIds.length) {
        throw new Error(`Some secondary ${entityType}s not found`);
      }
  
      // 3) Merge fields (fold secondaries into primary)
      let mergedValues = primary.get({ plain: true });
      for (const sec of secondaries) {
        mergedValues = mergeFields(
          mergedValues,
          sec.get({ plain: true }),
          strategy
        );
      }
  
      // Remove id so we don't accidentally overwrite
      delete mergedValues.id;
  
      // 4) Update primary
      await primary.update(mergedValues, { transaction: t });
  
      // 5) Move related rows + soft delete secondaries + add merge_map
      for (const sec of secondaries) {
        const secId = sec?.[id];
        console.log("Merging secondary:", secId);
        // Move related entities
        // await Promise.all(
        //   RELATED_MODELS.map((RM) =>
        //     RM.update(
        //       { entityId: primaryId },
        //       { where: { entityType, entityId: secId }, transaction: t }
        //     )
        //   )
        // );
  
        // TagMap often has unique constraints -> prefer insert-ignore style.
        // If TagMap has a unique index (entityType, entityId, tagId), then moving might collide.
        // If that’s your case, tell me your TagMap schema and I’ll switch this to de-dupe + bulkCreate.
  
        // Create merge map
        await MergeMap.create(
          {
            entityType,
            mergedFromId: secId,
            mergedIntoId: primaryId,
            mergedBy,
            reason,
          },
          { transaction: t }
        );
  
        // Soft-delete secondary (paranoid)
        await sec.destroy({ transaction: t }); // if paranoid true -> sets deletedAt
        // If not using paranoid, use: await sec.update({ deletedAt: new Date() }, { transaction: t })
      }
  
      return { entityType, primaryId, mergedIds: secondaryIds };
    });
  } catch (error) {
    console.log("Error in mergeEntitiesSequelize:", error);
  }
};
