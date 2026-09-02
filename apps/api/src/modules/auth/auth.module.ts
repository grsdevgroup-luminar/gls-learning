import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UsersModule } from "../users/users.module";
import { StorageModule } from "../storage/storage.module";
import { InstructorModule } from "../instructor/instructor.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { TokenService } from "./token.service";
import { AuthRepository } from "./auth.repository";
import { AvatarFilePipe } from "./pipes/avatar-file.pipe";

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({}), StorageModule, InstructorModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    AuthRepository,
    AvatarFilePipe,
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
