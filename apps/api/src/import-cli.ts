import { readFileSync } from "node:fs";
import { connect, db } from "./database";
import { Ingestion } from "./ingestion";
(async () => {
  const file = process.argv[2];
  if (!file) throw new Error("Pass a JSON dataset path");
  const input = JSON.parse(readFileSync(file, "utf8"));
  await connect();
  console.log(
    await new Ingestion(db).import(
      input.records || input,
      input.provenance || "Operator-authorized local dataset import",
    ),
  );
  await db.destroy();
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
