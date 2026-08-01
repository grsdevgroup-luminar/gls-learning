import { Body, Query } from "@nestjs/common";
import { ApiBody, ApiQuery } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import type { ZodSchema, ZodTypeAny } from "zod";
import * as zodToJsonSchemaModule from "zod-to-json-schema";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

/**
 * The Zod contracts in @skillstream/shared are the single source of truth for
 * both validation and docs. Request types are `z.infer<>` aliases, which erase
 * at runtime — so Swagger sees nothing unless the schema is handed to it
 * explicitly. These decorators do the validation and the OpenAPI registration
 * from one schema, so the docs cannot drift from what the API accepts.
 */
// zodToJsonSchema's published signature returns a deeply-recursive
// JsonSchema7Type behind a conditional generic, so tsc blows its instantiation
// depth limit (TS2589) merely resolving the export's type — a direct `as` cast
// on the named import still trips it. Erasing the whole module to `unknown`
// first keeps tsc away from that signature; the conversion is runtime-only.
const { zodToJsonSchema: toJsonSchema } = zodToJsonSchemaModule as unknown as {
  zodToJsonSchema: (
    schema: ZodTypeAny,
    options: { target: "openApi3"; $refStrategy: "none" },
  ) => SchemaObject;
};

export function zodSchemaObject(schema: ZodSchema): SchemaObject {
  return toJsonSchema(schema as ZodTypeAny, {
    target: "openApi3",
    // Inline everything: Swagger UI renders a self-contained schema per route
    // rather than chasing $refs into a definitions block we never emit.
    $refStrategy: "none",
  });
}

function methodDescriptor(
  target: object,
  key: string | symbol,
): PropertyDescriptor {
  return (
    Object.getOwnPropertyDescriptor(target, key) ?? {
      value: (target as Record<string | symbol, unknown>)[key],
    }
  );
}

/** `@Body()` + Zod validation + the matching OpenAPI request body. */
export function ZodBody<T>(schema: ZodSchema<T>): ParameterDecorator {
  return (target, key, index) => {
    if (key === undefined) return;
    Body(new ZodValidationPipe(schema))(target, key, index);
    ApiBody({ schema: zodSchemaObject(schema) })(
      target,
      key,
      methodDescriptor(target, key),
    );
  };
}

/**
 * `@Query()` + Zod validation + one OpenAPI query param per top-level key.
 * Query strings are flat, so an object schema maps to individual `?a=&b=`
 * params rather than a single JSON blob.
 */
export function ZodQuery<T>(schema: ZodSchema<T>): ParameterDecorator {
  return (target, key, index) => {
    if (key === undefined) return;
    Query(new ZodValidationPipe(schema))(target, key, index);

    const json = zodSchemaObject(schema);
    const required = new Set(json.required ?? []);
    const descriptor = methodDescriptor(target, key);

    for (const [name, prop] of Object.entries(json.properties ?? {})) {
      ApiQuery({
        name,
        required: required.has(name),
        schema: prop as SchemaObject,
      })(target, key, descriptor);
    }
  };
}
