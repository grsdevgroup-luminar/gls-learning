import path from "node:path";

import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { type Env, validateEnv } from "./config/env";
import { StorageModule } from "./modules/storage/storage.module";
import { PrismaModule } from "./prisma/prisma.module";
import { EmailModule } from "./modules/email/email.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { CoursesModule } from "./modules/courses/courses.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { EnrollmentModule } from "./modules/enrollment/enrollment.module";
import { CertificatesModule } from "./modules/certificates/certificates.module";
import { NotesModule } from "./modules/notes/notes.module";
import { QuizModule } from "./modules/quiz/quiz.module";
import { CommerceModule } from "./modules/commerce/commerce.module";
import { MediaModule } from "./modules/media/media.module";
import { AuthoringModule } from "./modules/authoring/authoring.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { InstructorModule } from "./modules/instructor/instructor.module";
import { AdminModule } from "./modules/admin/admin.module";
import { SalesAgentModule } from "./modules/sales-agent/sales-agent.module";
import { PayoutsModule } from "./modules/payouts/payouts.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { HealthController } from "./modules/health/health.controller";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { LoggingModule } from "./logging/logging.module";
import { RequestLoggingMiddleware } from "./logging/request-logging.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggingModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // Mount /uploads only when the local storage driver is in use — production
    // must never expose the API filesystem as static assets.
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        if (config.get("STORAGE_DRIVER", { infer: true }) !== "local") return [];
        const dir = config.get("STORAGE_LOCAL_DIR", { infer: true }) ?? "uploads";
        return [
          {
            rootPath: path.resolve(process.cwd(), dir),
            serveRoot: "/uploads",
            serveStaticOptions: { index: false, fallthrough: false },
          },
        ];
      },
    }),
    StorageModule,
    PrismaModule,
    EmailModule,
    UsersModule,
    AuthModule,
    CoursesModule,
    CategoriesModule,
    EnrollmentModule,
    CertificatesModule,
    NotesModule,
    QuizModule,
    CommerceModule,
    MediaModule,
    AuthoringModule,
    ReviewsModule,
    CommentsModule,
    InstructorModule,
    AdminModule,
    SalesAgentModule,
    PayoutsModule,
    OrganizationsModule,
    NotificationsModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
  }
}
