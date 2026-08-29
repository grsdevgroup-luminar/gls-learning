import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CategoryDto,
  CategoryProposalInput,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@skillstream/shared";
import type { RequestUser } from "../../common/decorators/decorators";
import { CategoriesRepository } from "./categories.repository";

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

@Injectable()
export class CategoriesService {
  constructor(private readonly repo: CategoriesRepository) {}

  async activeNames(): Promise<string[]> {
    const rows = await this.repo.findActive();
    return rows.map((row) => row.name);
  }

  async adminList(): Promise<CategoryDto[]> {
    const rows = await this.repo.findAll();
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        courseCount: await this.repo.countCourses(row.name),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    );
  }

  async ensureForAuthor(name: string, user: RequestUser): Promise<string> {
    const normalized = cleanName(name);
    const existing = await this.repo.findByName(normalized);
    if (existing?.status === "ACTIVE") return existing.name;

    if (user.role === "ADMIN") {
      if (existing) {
        const row = await this.repo.update(existing.id, {
          name: normalized,
          status: "ACTIVE",
        });
        return row.name;
      }
      const row = await this.repo.create({ name: normalized, status: "ACTIVE" });
      return row.name;
    }

    if (existing?.status === "PENDING") return existing.name;
    if (existing) {
      const row = await this.repo.update(existing.id, {
        proposedBy: { connect: { id: user.id } },
        status: "PENDING",
      });
      return row.name;
    }

    const row = await this.repo.create({
      name: normalized,
      status: "PENDING",
      proposedById: user.id,
    });
    return row.name;
  }

  async assertActive(name: string): Promise<string> {
    const row = await this.repo.findByName(cleanName(name));
    if (!row || row.status !== "ACTIVE") {
      throw new BadRequestException("This course category is awaiting admin approval");
    }
    return row.name;
  }

  async propose(input: CategoryProposalInput, user: RequestUser): Promise<CategoryDto> {
    const name = await this.ensureForAuthor(input.name, user);
    const row = await this.repo.findByName(name);
    if (!row) throw new NotFoundException("Category not found");
    return this.toDto(row);
  }

  async createByAdmin(input: CreateCategoryInput): Promise<CategoryDto> {
    const name = cleanName(input.name);
    const existing = await this.repo.findByName(name);
    const row = existing
      ? await this.repo.update(existing.id, { name, status: "ACTIVE" })
      : await this.repo.create({ name, status: "ACTIVE" });
    return this.toDto(row);
  }

  async updateByAdmin(id: string, input: UpdateCategoryInput): Promise<CategoryDto> {
    const current = await this.repo.findAll().then((rows) => rows.find((row) => row.id === id));
    if (!current) throw new NotFoundException("Category not found");

    const name = input.name ? cleanName(input.name) : current.name;
    const duplicate = await this.repo.findByName(name);
    if (duplicate && duplicate.id !== id) {
      throw new BadRequestException("A category with this name already exists");
    }

    const row = await this.repo.transaction(async (tx) => {
      if (name !== current.name) {
        await tx.course.updateMany({ where: { category: current.name }, data: { category: name } });
      }
      return tx.category.update({
        where: { id },
        data: { name, ...(input.status ? { status: input.status } : {}) },
      });
    });
    return this.toDto(row);
  }

  async removeByAdmin(id: string): Promise<{ ok: true; archived: boolean }> {
    const rows = await this.repo.findAll();
    const current = rows.find((row) => row.id === id);
    if (!current) throw new NotFoundException("Category not found");

    const courseCount = await this.repo.countCourses(current.name);
    if (courseCount > 0) {
      await this.repo.update(id, { status: "REJECTED" });
      return { ok: true, archived: true };
    }

    await this.repo.delete(id);
    return { ok: true, archived: false };
  }

  private async toDto(row: {
    id: string;
    name: string;
    status: "ACTIVE" | "PENDING" | "REJECTED";
    createdAt: Date;
    updatedAt: Date;
  }): Promise<CategoryDto> {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      courseCount: await this.repo.countCourses(row.name),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
