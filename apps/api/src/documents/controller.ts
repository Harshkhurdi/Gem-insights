import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { z } from "zod";
import { authenticated } from "../auth";
import { db } from "../database";
import { Documents, MAX_PDF_BYTES } from "./service";
@Injectable()
class DocumentAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!authenticated(req.headers.cookie))
      throw new HttpException("Administrator sign-in required", 401);
    if (
      req.method !== "GET" &&
      req.headers.origin !== (process.env.WEB_ORIGIN || "http://localhost:3000")
    )
      throw new HttpException("Untrusted request origin", 403);
    return true;
  }
}
@Controller("api/admin/documents")
@UseGuards(DocumentAdminGuard)
export class DocumentController {
  private documents = new Documents(db);
  @Post("batches") batch(@Body() body: unknown) {
    return this.documents.createBatch(body);
  }
  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: MAX_PDF_BYTES,
        files: 1,
        fields: 4,
        fieldSize: 3000,
        parts: 6,
      },
    }),
  )
  async upload(
    @UploadedFile() file: any,
    @Body() b: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const form = z
      .object({
        batchId: z.string().uuid(),
        sourceUrl: z.string().max(2000).optional(),
        reprocess: z.enum(["true", "false"]).optional(),
      })
      .strict()
      .parse(b);
    const r = await this.documents.upload(
      form.batchId,
      file,
      form.sourceUrl,
      form.reprocess === "true",
    );
    res.status(r.duplicate ? 200 : 202);
    return r;
  }
  @Get("organizations") organizations(@Query("q") q = "") {
    z.string().max(150).parse(q);
    return db.query(
      "SELECT source_key,name,state,district,department,ministry FROM organization WHERE name ILIKE $1 ORDER BY name LIMIT 100",
      ["%" + q + "%"],
    );
  }
  @Get() list(@Query() q: any) {
    return this.documents.list(
      z
        .object({
          page: z.coerce.number().optional(),
          batchId: z.string().uuid().optional(),
          status: z.string().optional(),
        })
        .strict()
        .parse(q),
    );
  }
  @Get(":id") detail(@Param("id") id: string) {
    return this.documents.detail(id);
  }
  @Get(":id/file") async file(@Param("id") id: string, @Res() res: any) {
    const bytes = await this.documents.file(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="authorized-source.pdf"',
    );
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.setHeader("Cache-Control", "no-store");
    res.send(bytes);
  }
  @Post(":id/review/:action") review(
    @Param("id") id: string,
    @Param("action") action: string,
    @Body() body: unknown,
  ) {
    return this.documents.review(
      id,
      z.enum(["save", "approve", "reject", "defer"]).parse(action),
      body,
    );
  }
  @Post(":id/retry") retry(@Param("id") id: string, @Body() body: unknown) {
    const b = z.object({ allowOcr: z.boolean() }).strict().parse(body);
    return this.documents.retry(id, b.allowOcr);
  }
}
