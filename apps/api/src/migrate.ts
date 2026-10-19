import { connect } from "./database";
connect()
  .then(async (d) => {
    const m = await d.runMigrations({ transaction: "all" });
    console.log(
      "Migrations applied:",
      m.map((v) => v.name),
    );
    await d.destroy();
  })
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
