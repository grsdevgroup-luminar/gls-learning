"use client";

import type { AdminStudentProfileDto } from "@/lib/api/endpoints";
import { initials, formatUsd } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Phone, CalendarDays, Flame, Award, BookOpen } from "lucide-react";
import { flagFor, formatCountry } from "@/lib/countries";

type StatusKey = "ACTIVE" | "IDLE" | "AT_RISK";

const statusBadge: Record<StatusKey, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "text-success" },
  IDLE: { label: "Idle", cls: "text-warning" },
  AT_RISK: { label: "At risk", cls: "text-destructive" },
};

/**
 * Shared learner profile view — same rich DTO/UI for both the platform
 * admin's Students page (GET /admin/students/:id/profile) and an org admin's
 * member view (GET /organizations/:id/members/:memberId/profile). Only the
 * data source differs; the read-only presentation is identical.
 */
export function StudentProfileDialog({
  student, open, loading, error, onOpenChange,
}: {
  student: AdminStudentProfileDto | undefined;
  open: boolean;
  loading: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="student-profile-dialog flex max-h-[min(760px,calc(100vh-2rem))] w-[calc(100vw-2rem)] !max-w-none flex-col overflow-visible sm:w-[min(760px,calc(100vw-3rem))] sm:min-w-[680px]">
        <DialogHeader>
          <DialogTitle>Student profile</DialogTitle>
          <DialogDescription>Contact details, learning interests, and engagement overview.</DialogDescription>
        </DialogHeader>
        <div className="student-profile-scroll min-h-0 flex-1 overflow-auto pr-1">
          {loading ? <ProfileSkeleton /> : error ? (
            <p className="py-8 text-sm text-destructive">Failed to load this student profile.</p>
          ) : student ? <ProfileDetails student={student} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfileDetails({ student }: { student: AdminStudentProfileDto }) {
  const badge = statusBadge[student.status as StatusKey] ?? { label: student.status, cls: "" };
  const interests = [...student.interests.categories, ...student.interests.keywords];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
        <Avatar className="h-16 w-16">
          {student.avatar && <AvatarImage src={student.avatar} alt="" />}
          <AvatarFallback className="brand-gradient text-lg text-white">{initials(student.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{student.name}</h3>
            <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{student.email}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info icon={Mail} label="Email" value={student.email} />
        <Info icon={Phone} label="Phone" value={student.phone ?? "Not provided"} />
        <Info icon={CalendarDays} label="Joined" value={formatDate(student.joinedAt)} />
        <Info icon={CalendarDays} label="Last activity" value={student.lastActivityAt ? formatDate(student.lastActivityAt) : "No activity yet"} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={BookOpen} label="Courses" value={student.enrollments} />
        <Metric icon={Award} label="Completed" value={student.completedCourses} />
        <Metric icon={Award} label="Certificates" value={student.certificates} />
        <Metric icon={Flame} label="Streak" value={`${student.streakDays} days`} />
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Profile details</h3>
        <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
          <InfoRow label="Country" value={student.country ? `${flagFor(student.country)} ${formatCountry(student.country)}` : "Not provided"} />
          <InfoRow label="Total spent" value={formatUsd(student.totalSpentCents / 100).replace(".00", "")} />
          <InfoRow label="Interests" value={interests.length ? interests.join(", ") : "Not completed"} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Course progress</h3>
        {student.courses.length ? <div className="space-y-2">
          {student.courses.map((course) => (
            <div key={course.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{course.title}</span>
                <span className="shrink-0 font-semibold tabular-nums">{course.progressPct}%</span>
              </div>
              <Progress value={course.progressPct} className="mt-2 h-1.5" />
              <p className="mt-2 text-xs text-muted-foreground">
                {course.completedLessons}/{course.totalLessons} lessons · {course.status === "COMPLETED" ? `Completed ${formatDate(course.completedAt ?? course.lastActivityAt)}` : `Last active ${formatDate(course.lastActivityAt)}`}
                {course.certificateIssuedAt ? " · Certificate issued" : ""}
              </p>
            </div>
          ))}
        </div> : <p className="rounded-lg border p-4 text-sm text-muted-foreground">No course enrollments yet.</p>}
      </section>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="rounded-lg border p-3"><Icon className="mb-2 h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-medium" title={value}>{value}</p></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string | number }) {
  return <div className="rounded-lg border p-3"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><span className="text-xs text-muted-foreground">{label}</span><p className="mt-0.5 text-sm">{value}</p></div>;
}

function ProfileSkeleton() {
  return <div className="space-y-4 py-2">{["h-20", "h-24", "h-32", "h-44"].map((height) => <div key={height} className={`animate-pulse rounded-lg bg-muted ${height}`} />)}</div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}
