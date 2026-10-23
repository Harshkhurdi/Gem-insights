import { NOTICE_KINDS } from "../../../../packages/core/notice-kind";
import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import { authenticated } from "../auth";
import { db } from "../database";
import { Collection } from "./service";
import { getSource } from "./registry";
import { NoticeDocuments } from "./document-fetch";
const noticeDocuments = new NoticeDocuments(db);
const collection = new Collection(db);
function admin(req: any) {
  if (!authenticated(req.headers.cookie))
    throw new HttpException("Administrator sign-in required", 401);
  if (
    req.method !== "GET" &&
    req.headers.origin !== (process.env.WEB_ORIGIN || "http://localhost:3000")
  )
    throw new HttpException("Untrusted request origin", 403);
}
@Controller("api")
export class CollectionController {
  @Get("collection") summary() {
    return collection.summary();
  }
  @Get("collection/notices") notices(@Query() query: unknown) {
    const q = z
      .object({
        search: z.string().max(200).optional(),
        source: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        medical: z
          .enum(["true", "false"])
          .transform((v) => v === "true")
          .optional(),
        status: z.enum(["pending", "approved", "dismissed"]).optional(),
        kind: z.enum(NOTICE_KINDS).optional(),
        product: z.string().max(100).optional(),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .strict()
      .parse(query);
    return collection.notices(q);
  }
  @Get("admin/collection/notices/:id") async detail(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    admin(req);
    z.string().uuid().parse(id);
    try {
      return await collection.detail(id);
    } catch {
      throw new HttpException("Notice not found", 404);
    }
  }
  @Post("admin/collection/run") async run(
    @Req() req: any,
    @Body() body: unknown,
  ) {
    admin(req);
    const b = z
      .object({ sourceId: z.string().max(100).optional() })
      .strict()
      .parse(body);
    if (b.sourceId) {
      let s;
      try {
        s = getSource(b.sourceId);
      } catch {
        throw new HttpException("Unknown collection source", 404);
      }
      if (!s.adapter)
        throw new HttpException(
          "Assisted source: use CSV/JSON or source-document review",
          409,
        );
    }
    return collection.queue(b.sourceId);
  }
  @Patch("admin/collection/sources/:id") async configure(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    admin(req);
    let source;
    try {
      source = getSource(id);
    } catch {
      throw new HttpException("Unknown source", 404);
    }
    if (!source.adapter)
      throw new HttpException(
        "Automated adapter unavailable for this source",
        409,
      );
    const b = z
      .object({
        enabled: z.boolean(),
        intervalMinutes: z.number().int().min(15).max(10080),
      })
      .strict()
      .parse(body);
    await db.query(
      "UPDATE source SET enabled=$2,interval_minutes=$3,next_collection_at=now() WHERE id=$1",
      [id, b.enabled, b.intervalMinutes],
    );
    return { saved: true };
  }
  @Post("admin/collection/notices/:id/extract") async extract(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    admin(req);
    z.string().uuid().parse(id);
    const b = z
      .object({
        expectedHash: z.string().regex(/^[a-f0-9]{64}$/),
        documentIndex: z.number().int().min(0).max(999).default(0),
      })
      .strict()
      .parse(body);
    try {
      return await noticeDocuments.queue(id, b.expectedHash, b.documentIndex);
    } catch (e) {
      throw new HttpException((e as Error).message, 409);
    }
  }
  @Post("admin/collection/notices/:id/dismiss") async dismiss(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    admin(req);
    z.string().uuid().parse(id);
    const b = z
      .object({
        expectedHash: z.string().length(64),
        reason: z.string().trim().min(5).max(2000),
      })
      .strict()
      .parse(body);
    const rows = await db.query(
      "UPDATE discovered_notice SET review_status='dismissed',review_reason=$3,reviewed_at=now() WHERE id=$1 AND current_hash=$2 AND review_status<>'approved' RETURNING id",
      [id, b.expectedHash, b.reason],
    );
    if (!rows.length)
      throw new HttpException(
        "Notice changed or is already approved; reload",
        409,
      );
    return { dismissed: true };
  }
  @Post("admin/collection/notices/:id/approve") async approve(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    admin(req);
    z.string().uuid().parse(id);
    const b = z
      .object({
        expectedHash: z.string().length(64),
        expectedTenderHash: z.string().length(64).nullable(),
        record: z.unknown(),
        reason: z.string().trim().min(10).max(2000),
        reviewedOriginal: z.literal(true),
        completeSnapshot: z.literal(true),
      })
      .strict()
      .parse(body);
    try {
      return await collection.approve(id, b);
    } catch (e) {
      if (e instanceof z.ZodError) throw e;
      throw new HttpException((e as Error).message, 409);
    }
  }
}
