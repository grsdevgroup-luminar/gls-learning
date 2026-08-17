import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  addCartItemSchema,
  mergeCartSchema,
  setCartCouponSchema,
  type AddCartItemInput,
  type MergeCartInput,
  type SetCartCouponInput,
} from "@skillstream/shared";
import { CurrentUser, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody } from "../../common/utils/swagger";
import { CartService } from "./cart.service";

@ApiTags("cart")
@ApiBearerAuth()
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser() user: RequestUser) {
    return this.cart.get(user.id);
  }

  @Post("items")
  addItem(
    @CurrentUser() user: RequestUser,
    @ZodBody(addCartItemSchema) body: AddCartItemInput,
  ) {
    return this.cart.addItem(user.id, body.courseId);
  }

  @Delete("items/:courseId")
  removeItem(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
  ) {
    return this.cart.removeItem(user.id, courseId);
  }

  @Delete()
  clear(@CurrentUser() user: RequestUser) {
    return this.cart.clear(user.id);
  }

  @Patch("coupon")
  setCoupon(
    @CurrentUser() user: RequestUser,
    @ZodBody(setCartCouponSchema) body: SetCartCouponInput,
  ) {
    return this.cart.setCoupon(user.id, body.couponCode);
  }

  /** Called by web store after login — merges guest localStorage cart into DB. */
  @Post("merge")
  merge(
    @CurrentUser() user: RequestUser,
    @ZodBody(mergeCartSchema) body: MergeCartInput,
  ) {
    return this.cart.merge(user.id, body);
  }
}
