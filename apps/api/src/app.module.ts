import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { validateEnv } from "./config/env";
import { PrismaModule } from "./prisma/prisma.module";
import { EmailModule } from "./modules/email/email.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { CoursesModule } from "./modules/courses/courses.module";
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
import { JobsModule } from "./modules/jobs/jobs.module";
import { HealthController } from "./modules/health/health.controller";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { singleLine: true } }
            : undefined,
        autoLogging: true,
        redact: ["req.headers.cookie", "req.headers.authorization"],
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    EmailModule,
    UsersModule,
    AuthModule,
    CoursesModule,
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
export class AppModule {}
