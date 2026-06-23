import type { Order } from "@/types";

export const orders: Order[] = [
  {
    id: "ord_10293", date: "2026-06-22", studentName: "Alex Morgan", studentEmail: "student@demo.com",
    country: "United States",
    items: [{ courseId: "c_react", title: "Modern React Masterclass", price: 89.99 }],
    subtotal: 89.99, discount: 36.0, total: 53.99, coupon: "LAUNCH40", gateway: "stripe", status: "paid",
  },
  {
    id: "ord_10292", date: "2026-06-22", studentName: "Rahul Verma", studentEmail: "rahul@example.com",
    country: "India",
    items: [{ courseId: "c_python", title: "Python for Everybody", price: 17.49 }],
    subtotal: 17.49, discount: 0, total: 17.49, gateway: "stripe", status: "paid",
  },
  {
    id: "ord_10291", date: "2026-06-21", studentName: "Bianca Rossi", studentEmail: "bianca@example.com",
    country: "Brazil",
    items: [{ courseId: "c_ml", title: "Machine Learning Foundations", price: 69.99 }],
    subtotal: 69.99, discount: 7.0, total: 62.99, coupon: "WELCOME10", gateway: "paypal", status: "paid",
  },
  {
    id: "ord_10290", date: "2026-06-20", studentName: "Emma Schmidt", studentEmail: "emma@example.com",
    country: "Germany",
    items: [{ courseId: "c_aws", title: "AWS for Developers", price: 84.99 }],
    subtotal: 84.99, discount: 0, total: 84.99, gateway: "stripe", status: "paid",
  },
  {
    id: "ord_10289", date: "2026-06-19", studentName: "Kwame Mensah", studentEmail: "kwame@example.com",
    country: "Nigeria",
    items: [{ courseId: "c_growth", title: "Growth Marketing for Founders", price: 26.99 }],
    subtotal: 26.99, discount: 0, total: 26.99, gateway: "stripe", status: "paid",
  },
  {
    id: "ord_10288", date: "2026-06-19", studentName: "Yuki Tanaka", studentEmail: "yuki@example.com",
    country: "Japan",
    items: [
      { courseId: "c_ts", title: "TypeScript Deep Dive", price: 74.99 },
      { courseId: "c_design", title: "Product Design Essentials", price: 69.99 },
    ],
    subtotal: 144.98, discount: 57.99, total: 86.99, coupon: "LAUNCH40", gateway: "paypal", status: "paid",
  },
  {
    id: "ord_10287", date: "2026-06-18", studentName: "Sofia Reyes", studentEmail: "sofia@example.com",
    country: "Mexico",
    items: [{ courseId: "c_design", title: "Product Design Essentials", price: 48.99 }],
    subtotal: 48.99, discount: 0, total: 48.99, gateway: "stripe", status: "refunded",
  },
  {
    id: "ord_10286", date: "2026-06-17", studentName: "Daniel Tran", studentEmail: "daniel@example.com",
    country: "Australia",
    items: [{ courseId: "c_react", title: "Modern React Masterclass", price: 89.99 }],
    subtotal: 89.99, discount: 0, total: 89.99, gateway: "stripe", status: "paid",
  },
];
