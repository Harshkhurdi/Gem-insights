import "reflect-metadata";
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Res,
  Module,
  HttpException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { connect, db } from "./database";
import { Analytics, filterSchema } from "./analytics";
import { CollectionController } from "./collection/controller";
import { DocumentController } from "./documents/controller";
import { Ingestion } from "./ingestion";
import { authenticated, configured, validKey, session } from "./auth";
import { STATES, classify } from "../../../packages/core/domain";
const analytics = new Analytics(db),
  ingest = new Ingestion(db);
const attempts = new Map<string, { count: number; start: number }>();
function filters(q: unknown) {
  return filterSchema.parse(q);
}
function admin(req: any) {
  if (!authenticated(req.headers.cookie))
    throw new HttpException("Administrator sign-in required", 401);
  if (
    req.method !== "GET" &&
    req.headers.origin !== (process.env.WEB_ORIGIN || "http://localhost:3000")
  )
    throw new HttpException("Untrusted request origin", 403);
}
const importBody = z
  .object({
    records: z.array(z.unknown()).min(1).max(1000),
    provenance: z.string().trim().min(10).max(2000),
    authorized: z.literal(true),
  })
  .strict();
@Controller("api")
class Api {
  @Get("health") async health() {
    await db.query("SELECT 1");
    return { status: "ok", database: "postgresql" };
  }
  @Get("overview") overview(@Query() q: any) {
    return analytics.overview(filters(q));
  }
  @Get("products") products(@Query() q: any) {
    return analytics.products(filters(q));
  }
  @Get("products/:id") async product(@Param("id") id: string, @Query() q: any) {
    const rows = await db.query("SELECT * FROM product WHERE id=$1", [id]);
    if (!rows[0]) throw new HttpException("Product not found", 404);
    return {
      ...rows[0],
      analytics: await analytics.products(filters({ ...q, product: id })),
      tenders: await analytics.tenders(filters({ ...q, product: id })),
    };
  }
  @Get("products/:id/analytics") productStats(
    @Param("id") id: string,
    @Query() q: any,
  ) {
    return analytics.products(filters({ ...q, product: id }));
  }
  @Get("categories") categories(@Query() q: any) {
    return analytics.categories(filters(q));
  }
  @Get("taxonomy") async taxonomy() {
    return {
      categories: await db.query("SELECT * FROM category ORDER BY name"),
      products: await db.query(
        "SELECT p.*,c.name AS category FROM product p JOIN category c ON c.id=p.category_id ORDER BY p.name",
      ),
      states: STATES,
    };
  }
  @Get("categories/:id/analytics") category(
    @Param("id") id: string,
    @Query() q: any,
  ) {
    return analytics.products(filters({ ...q, category: id }));
  }
  @Get("geography/states") states(@Query() q: any) {
    return analytics.states(filters(q));
  }
  @Get("geography/states/:state") async state(
    @Param("state") state: string,
    @Query() q: any,
  ) {
    const f = filters({ ...q, state });
    return {
      states: await analytics.states(f),
      buyers: await analytics.buyers(f),
      districts: await analytics.districts(f),
      tenders: await analytics.tenders(f),
    };
  }
  @Get("geography/districts") districts(@Query() q: any) {
    return analytics.districts(filters(q));
  }
  @Get("buyers") buyers(@Query() q: any) {
    return analytics.buyers(filters(q));
  }
  @Get("buyers/:id") async buyer(@Param("id") id: string, @Query() q: any) {
    z.string().uuid().parse(id);
    const f = filters({ ...q, buyer: id });
    return {
      buyers: await analytics.buyers(f),
      products: await analytics.products(f),
      tenders: await analytics.tenders(f),
    };
  }
  @Get("trends") trends(@Query() q: any) {
    return analytics.trends(filters(q));
  }
  @Get("growth") growth(@Query() q: any) {
    return analytics.growth(filters(q));
  }
  @Get("tenders") tenders(@Query() q: any) {
    return analytics.tenders(filters(q));
  }
  @Get("tenders/:id") async tender(@Param("id") id: string) {
    z.string().uuid().parse(id);
    const t = (
      await db.query(
        "SELECT t.*,o.name AS buyer_name,o.state AS buyer_state FROM tender t JOIN organization o ON o.id=t.organization_id WHERE t.id=$1",
        [id],
      )
    )[0];
    if (!t) throw new HttpException("Tender not found", 404);
    return {
      ...t,
      items: await db.query(
        "SELECT l.*,p.name AS product_name,COALESCE((SELECT jsonb_agg(d) FROM destination d WHERE d.line_item_id=l.id),'[]') AS destinations FROM line_item l LEFT JOIN product p ON p.id=l.product_id WHERE l.tender_id=$1",
        [id],
      ),
      documents: await db.query("SELECT * FROM document WHERE tender_id=$1", [
        id,
      ]),
      versions: await db.query(
        "SELECT id,hash,observed_at,run_id FROM tender_version WHERE tender_id=$1 ORDER BY observed_at DESC",
        [id],
      ),
      corrections: await db.query(
        "SELECT source_key,product_id,reason,created_at FROM correction WHERE tender_id=$1",
        [id],
      ),
    };
  }
  @Get("coverage") coverage() {
    return analytics.coverage();
  }
  @Get("ingestion/status") ingestion() {
    return analytics.coverage();
  }
  @Get("auth") auth(@Req() req: any) {
    return {
      authenticated: authenticated(req.headers.cookie),
      configured: configured(),
    };
  }
  @Post("auth/login") login(
    @Req() req: any,
    @Body() b: any,
    @Res({ passthrough: true }) res: any,
  ) {
    if (
      req.headers.origin !== (process.env.WEB_ORIGIN || "http://localhost:3000")
    )
      throw new HttpException("Untrusted request origin", 403);
    const key = z
      .object({ key: z.string().max(500) })
      .strict()
      .parse(b).key;
    const ip = req.ip || "unknown";
    let rate = attempts.get(ip);
    if (!rate || Date.now() - rate.start > 60000) {
      rate = { start: Date.now(), count: 0 };
      attempts.set(ip, rate);
    }
    if (attempts.size > 5000) attempts.clear();
    if (++rate.count > 8)
      throw new HttpException("Too many attempts; try in one minute", 429);
    if (!validKey(key))
      throw new HttpException(
        configured()
          ? "Invalid administrator key"
          : "Set a 24-character or longer ADMIN_KEY on the server",
        401,
      );
    res.cookie("gem_session", session(), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 3600000,
      path: "/",
    });
    return { authenticated: true };
  }
  @Post("auth/logout") logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    admin(req);
    res.clearCookie("gem_session", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return { authenticated: false };
  }
  @Get("admin/review") async review(@Req() req: any) {
    admin(req);
    return db.query(
      "SELECT l.*,t.bid_number FROM line_item l JOIN tender t ON t.id=l.tender_id WHERE needs_review ORDER BY t.updated_at DESC LIMIT 100",
    );
  }
  @Post("admin/import") async imports(
    @Req() req: any,
    @Body() body: any,
    @Res({ passthrough: true }) res: any,
  ) {
    admin(req);
    const b = importBody.parse(body);
    const id = randomUUID();
    await db.query("INSERT INTO job(id,kind,payload) VALUES($1,'import',$2)", [
      id,
      JSON.stringify(b),
    ]);
    res.status(202);
    return { jobId: id, status: "queued" };
  }
  @Post("admin/ingestion/run") async run(@Req() req: any) {
    admin(req);
    if (
      !process.env.AUTHORIZED_FEED_URL ||
      process.env.FEED_AUTHORIZED !== "true"
    )
      throw new HttpException(
        "Live GeM access unverified. Configure an authorized JSON feed or import a dataset.",
        409,
      );
    const id = randomUUID();
    await db.query(
      "INSERT INTO job(id,kind,payload) VALUES($1,'feed','{}') ON CONFLICT DO NOTHING",
      [id],
    );
    return { status: "queued_or_already_pending" };
  }
  @Post("admin/jobs/:id/retry") async retry(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    admin(req);
    z.string().uuid().parse(id);
    const job = (await db.query("SELECT kind FROM job WHERE id=$1", [id]))[0];
    if (job?.kind === "pdf")
      throw new HttpException(
        "Retry or reupload through document review so source availability and OCR permission are checked.",
        409,
      );
    const r = await db.query(
      "UPDATE job SET status='pending',attempts=0,available_at=now(),last_error=NULL WHERE id=$1 AND status='failed' RETURNING id",
      [id],
    );
    if (!r.length) throw new HttpException("Failed job not found", 404);
    return { queued: true };
  }
  @Post("admin/classifications/:id/correct") correct(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    admin(req);
    z.string().uuid().parse(id);
    const b = z
      .object({
        productId: z.string().max(100).nullable(),
        reason: z.string().trim().min(5).max(2000),
      })
      .strict()
      .parse(body);
    return ingest.correct(id, b.productId, b.reason);
  }
  @Post("admin/categories") async addCategory(
    @Req() req: any,
    @Body() body: any,
  ) {
    admin(req);
    const b = z
      .object({
        id: z.string().regex(/^[a-z0-9-]{1,80}$/),
        parentId: z.string().max(80),
        name: z.string().trim().min(2).max(150),
        active: z.boolean(),
      })
      .strict()
      .parse(body);
    await db.query("INSERT INTO category VALUES($1,$2,$3,$4)", [
      b.id,
      b.parentId,
      b.name,
      b.active,
    ]);
    return b;
  }
  @Post("admin/products") async addProduct(@Req() req: any, @Body() body: any) {
    admin(req);
    const b = z
      .object({
        id: z.string().regex(/^[a-z0-9-]{1,80}$/),
        name: z.string().trim().min(2).max(150),
        categoryId: z.string().max(80),
        aliases: z.array(z.string().trim().min(2).max(120)).min(1).max(100),
      })
      .strict()
      .parse(body);
    await db.query("INSERT INTO product VALUES($1,$2,$3,$4)", [
      b.id,
      b.name,
      b.categoryId,
      JSON.stringify(b.aliases),
    ]);
    return b;
  }
  @Patch("admin/products/:id") async aliases(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    admin(req);
    const b = z
      .object({
        aliases: z.array(z.string().trim().min(2).max(120)).min(1).max(100),
      })
      .strict()
      .parse(body);
    const r = await db.query(
      "UPDATE product SET aliases=$2 WHERE id=$1 RETURNING *",
      [id, JSON.stringify(b.aliases)],
    );
    if (!r[0]) throw new HttpException("Product not found", 404);
    return r[0];
  }
  @Post("admin/reclassify") async reclassify(@Req() req: any) {
    admin(req);
    const id = randomUUID();
    await db.query(
      "INSERT INTO job(id,kind,payload) VALUES($1,'classify','{}')",
      [id],
    );
    return { jobId: id };
  }
}
@Module({ controllers: [Api, DocumentController, CollectionController] })
class App {}
async function bootstrap() {
  await connect();
  const app = await NestFactory.create<NestExpressApplication>(App, {
    bodyParser: true,
  });
  app.useBodyParser("json", { limit: "5mb" });
  app.enableCors({
    origin: process.env.WEB_ORIGIN || "http://localhost:3000",
    credentials: true,
  });
  app.use((req: any, res: any, next: any) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.useGlobalFilters({
    catch(e: any, host: any) {
      const res = host.switchToHttp().getResponse();
      const status =
        e instanceof z.ZodError
          ? 400
          : e.getStatus?.() ||
            (e.code === "23505" ? 409 : e.code === "23503" ? 400 : 500);
      if (status === 500) console.error(e);
      res.status(status).json({
        error:
          status === 500 ? "Request failed. Check server logs." : e.message,
        details: e instanceof z.ZodError ? e.issues : undefined,
      });
    },
  });
  const instance = app.getHttpAdapter().getInstance();
  instance.get("/api/openapi.json", (_req: any, res: any) =>
    res.json({
      openapi: "3.0.3",
      info: { title: "GeM Intelligence API", version: "0.1.0" },
      paths: Object.fromEntries(
        [
          "overview",
          "products",
          "categories",
          "taxonomy",
          "geography/states",
          "geography/districts",
          "buyers",
          "trends",
          "growth",
          "tenders",
          "coverage",
          "health",
        ].map((p) => [
          "/api/" + p,
          {
            get: {
              summary: p,
              responses: { 200: { description: "Query result" } },
            },
          },
        ]),
      ),
    }),
  );
  await app.listen(
    Number(process.env.PORT) || 4000,
    process.env.API_HOST || "127.0.0.1",
  );
  console.log("GeM Intelligence API ready");
}
bootstrap().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
