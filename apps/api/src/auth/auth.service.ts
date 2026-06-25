import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import type {
  AuthUserDto,
  LoginInput,
  RegisterInput,
} from "@skillstream/shared";
import { UsersService } from "../users/users.service";
import { TokenService } from "./token.service";

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput, meta: SessionMeta) {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const user = await this.users.create({
      email: input.email.toLowerCase(),
      name: input.name,
      country: input.country,
      passwordHash,
      role: "STUDENT",
      studentProfile: { create: {} },
    });
    return this.issueSession(user.id, user.email, user.role, meta);
  }

  async login(input: LoginInput, meta: SessionMeta) {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");
    return this.issueSession(user.id, user.email, user.role, meta);
  }

  async refresh(rawRefreshToken: string | undefined, meta: SessionMeta) {
    if (!rawRefreshToken) throw new UnauthorizedException("Missing refresh token");
    const rotated = await this.tokens.rotateRefreshToken(rawRefreshToken, meta);
    if (!rotated) throw new UnauthorizedException("Invalid refresh token");
    const user = await this.users.findById(rotated.userId);
    if (!user) throw new UnauthorizedException();
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken,
      refreshToken: rotated.newToken,
      expiresIn: this.tokens.accessTtlSeconds,
    };
  }

  async logout(rawRefreshToken: string | undefined) {
    if (rawRefreshToken) await this.tokens.revokeRefreshToken(rawRefreshToken);
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.users.findWithProfiles(userId);
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      country: user.country,
      role: user.role,
      emailVerified: user.emailVerified,
      instructorStatus: user.instructorProfile?.status ?? null,
    };
  }

  private async issueSession(
    userId: string,
    email: string,
    role: "STUDENT" | "INSTRUCTOR" | "ADMIN",
    meta: SessionMeta,
  ) {
    const accessToken = this.tokens.signAccessToken({ sub: userId, email, role });
    const refreshToken = await this.tokens.issueRefreshToken(userId, meta);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.tokens.accessTtlSeconds,
    };
  }
}
