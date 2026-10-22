import { connect, db } from "../database";
import { Collection } from "./service";
import { getSource } from "./registry";
import { collectionSources } from "./regions";
async function main() {
  const id = process.argv[2];
  if (id && !["all", "north"].includes(id)) getSource(id);
  await connect();
  try {
    const collection = new Collection(db);
    const sources =
      id && !["all", "north"].includes(id)
        ? [getSource(id)]
        : collectionSources(
            id === "north" ? "north" : id === "all" ? "all" : undefined,
          );
    for (const s of sources) {
      try {
        console.log(
          JSON.stringify({ source: s.id, ...(await collection.run(s.id)) }),
        );
      } catch (e) {
        console.error(
          JSON.stringify({ source: s.id, error: (e as Error).message }),
        );
        process.exitCode = 1;
      }
    }
    console.log(JSON.stringify((await collection.summary()).counts));
  } finally {
    await db.destroy();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
