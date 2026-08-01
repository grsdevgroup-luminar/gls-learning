import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

/**
 * Validates/parses an incoming payload against a Zod schema (from
 * @skillstream/shared). Usage: `@Body(new ZodValidationPipe(loginSchema))`.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: result.error.issues.map(
          (i) => `${i.path.join(".") || "body"}: ${i.message}`,
        ),
        error: "ValidationError",
      });
    }
    return result.data;
  }
}
