import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { validateEnv } from "./config/env";
import { PrismaModule } from "./prisma/prisma.module";
import { EmailModule } from "./email/email.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CoursesModule } from "./courses/courses.module";
import { EnrollmentModule } from "./enrollment/enrollment.module";
import { QuizModule } from "./quiz/quiz.module";
import { CommerceModule } from "./commerce/commerce.module";
import { MediaModule } from "./media/media.module";
import { AuthoringModule } from "./authoring/authoring.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { CommentsModule } from "./comments/comments.module";
import { InstructorModule } from "./instructor/instructor.module";
import { AdminModule } from "./admin/admin.module";
import { SalesAgentModule } from "./sales-agent/sales-agent.module";
import { PayoutsModule } from "./payouts/payouts.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { JobsModule } from "./jobs/jobs.module";
import { HealthController } from "./health/health.controller";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { JwtAuthGuard } from "./common/jwt-auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { AuditInterceptor } from "./common/audit.interceptor";

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
