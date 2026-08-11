import type { OrdersService } from "../commerce/orders.service";

export type OrderRow = NonNullable<
  Awaited<ReturnType<OrdersService["findById"]>>
>;
