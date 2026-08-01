import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { Controller, Post, Get } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { z } from "zod";
import { ZodBody, ZodQuery, zodSchemaObject } from "../utils/swagger";

const bodySchema = z.object({
  email: z.string().email(),
  age: z.number().min(18).optional(),
});
const querySchema = z.object({
  page: z.coerce.number().default(1),
  q: z.string().min(2),
});

@Controller("things")
class ThingsController {
  @Post()
  create(@ZodBody(bodySchema) body: z.infer<typeof bodySchema>) {
    return body;
  }

  @Get()
  list(@ZodQuery(querySchema) query: z.infer<typeof querySchema>) {
    return query;
  }
}

async function buildDocument() {
  const moduleRef = await Test.createTestingModule({
    controllers: [ThingsController],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("t").setVersion("1").build(),
  );
  await app.close();
  return doc;
}

describe("zodSchemaObject", () => {
  it("converts a zod object into an OpenAPI schema", () => {
    const schema = zodSchemaObject(bodySchema);
    expect(schema.type).toBe("object");
    expect(schema.properties?.email).toMatchObject({ format: "email" });
    expect(schema.required).toEqual(["email"]);
  });
});

describe("ZodBody", () => {
  it("documents the request body from the same schema that validates it", async () => {
    const doc = await buildDocument();
    const body = doc.paths["/things"]?.post?.requestBody;
    const schema = (body as { content: Record<string, { schema: never }> })
      .content["application/json"].schema as {
      properties: Record<string, unknown>;
      required: string[];
    };

    // The regression this guards: z.infer<> types erase at runtime, so before
    // ZodBody every POST rendered with no body schema at all.
    expect(schema.properties.email).toBeDefined();
    expect(schema.required).toEqual(["email"]);
  });
});

describe("ZodQuery", () => {
  it("documents one query param per top-level key, with correct requiredness", async () => {
    const doc = await buildDocument();
    const params = doc.paths["/things"]?.get?.parameters ?? [];
    const byName = Object.fromEntries(
      params.map((p) => [(p as { name: string }).name, p]),
    );

    expect(Object.keys(byName).sort()).toEqual(["page", "q"]);
    expect(byName.q).toMatchObject({ in: "query", required: true });
    // `page` has a default, so it must not be advertised as required.
    expect(byName.page).toMatchObject({ in: "query", required: false });
  });
});
