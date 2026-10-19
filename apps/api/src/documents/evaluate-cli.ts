import { connect, db } from "../database";
import { Evaluation } from "./evaluation";
async function main() {
  try {
    await connect();
    console.log(JSON.stringify(await new Evaluation(db).report(true), null, 2));
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
