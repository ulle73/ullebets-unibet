export async function findDuplicateKeys(db, collectionName, keyFields) {
  const groupId = Object.fromEntries(keyFields.map((field) => [field, `$${field}`]));

  return db.collection(collectionName).aggregate([
    {
      $group: {
        _id: groupId,
        count: { $sum: 1 },
        ids: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
}

function queryFromDuplicateKey(keyFields, duplicateKey) {
  return Object.fromEntries(keyFields.map((field) => [field, duplicateKey[field] ?? null]));
}

function stableKeepSort(extraSort = {}) {
  return {
    ...extraSort,
    updated_at: -1,
    last_seen_at: -1,
    created_at: -1,
    first_seen_at: -1,
    _id: -1,
  };
}

export async function cleanupDuplicatesByKey(db, {
  collectionName,
  keyFields,
  dryRun = false,
  keepSort = {},
  maxGroups = 5000,
} = {}) {
  if (!collectionName) throw new Error("cleanupDuplicatesByKey: missing collectionName");
  if (!Array.isArray(keyFields) || keyFields.length === 0) {
    throw new Error("cleanupDuplicatesByKey: keyFields must be a non-empty array");
  }

  const collection = db.collection(collectionName);
  const duplicateGroups = await findDuplicateKeys(db, collectionName, keyFields);
  const limitedGroups = duplicateGroups.slice(0, maxGroups);
  const now = new Date();

  let removed = 0;
  const samples = [];

  for (const group of limitedGroups) {
    const query = queryFromDuplicateKey(keyFields, group._id);
    const docs = await collection.find(query).sort(stableKeepSort(keepSort)).toArray();

    if (docs.length <= 1) continue;

    const [keep, ...duplicates] = docs;
    const duplicateIds = duplicates.map((doc) => doc._id);

    samples.push({
      key: group._id,
      count: docs.length,
      keeping: String(keep._id),
      removing: duplicateIds.map(String),
    });

    if (!dryRun) {
      await collection.updateOne(
        { _id: keep._id },
        {
          $set: {
            dedupe_status: "cleaned",
            dedupe_key_fields: keyFields,
            dedupe_last_run_at: now,
            dedupe_removed_count: duplicateIds.length,
          },
          $addToSet: {
            dedupe_removed_ids: { $each: duplicateIds.map(String) },
          },
        }
      );

      const deleteResult = await collection.deleteMany({ _id: { $in: duplicateIds } });
      removed += deleteResult.deletedCount || 0;
    } else {
      removed += duplicateIds.length;
    }
  }

  return {
    collectionName,
    keyFields,
    dryRun,
    duplicateGroupsFound: duplicateGroups.length,
    duplicateGroupsProcessed: limitedGroups.length,
    documentsRemovedOrWouldRemove: removed,
    truncated: duplicateGroups.length > limitedGroups.length,
    samples: samples.slice(0, 25),
  };
}
