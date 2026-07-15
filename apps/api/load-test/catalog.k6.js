// k6 load test for the hottest read paths.
// Run:  k6 run apps/api/load-test/catalog.k6.js
// Override base URL:  BASE_URL=https://api.example.com/api k6 run ...
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:4000/api";

export const options = {
  stages: [
    { duration: "30s", target: 50 }, // ramp up
    { duration: "1m", target: 50 }, // sustain
    { duration: "20s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<400"],
  },
};

export default function () {
  const list = http.get(`${BASE}/courses?pageSize=12&sort=popular`);
  check(list, { "catalog 200": (r) => r.status === 200 });

  const detail = http.get(`${BASE}/courses/modern-react-masterclass`);
  check(detail, { "detail 200": (r) => r.status === 200 });

  sleep(1);
}
