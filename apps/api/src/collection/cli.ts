import { connect, db } from "../database";
import { Collection } from "./service";
import { SOURCES, getSource } from "./registry";
async function main() {
  const id = process.argv[2];
  if (id && id !== "all") getSource(id);
  await connect();
  try {
    const collection = new Collection(db);
    for (const s of SOURCES.filter(
      (s) => s.adapter && (!id || id === "all" || s.id === id),
    )) {
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
