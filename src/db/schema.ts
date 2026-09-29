import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/*
 * =========================================================
 * ENUMS
 * =========================================================
 */

export const orderStatusEnum =
  pgEnum("order_status", [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "completed",
    "cancelled",
  ]);

export const paymentStatusEnum =
  pgEnum("payment_status", [
    "unpaid",
    "paid",
  ]);

/*
 * =========================================================
 * CATEGORIES
 * =========================================================
 */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    name: varchar("name", {
      length: 255,
    }).notNull(),

    slug: varchar("slug", {
      length: 300,
    })
      .notNull()
      .unique(),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
      }
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
      }
    )
      .defaultNow()
      .notNull(),
  }
);

/*
 * =========================================================
 * PRODUCTS
 * =========================================================
 */

export const products = pgTable(
  "products",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    title: varchar("title", {
      length: 255,
    }).notNull(),

    slug: varchar("slug", {
      length: 300,
    })
      .notNull()
      .unique(),

    /*
     * For products with variants, this acts
     * as the product's primary/default SKU.
     */
    sku: varchar("sku", {
      length: 150,
    })
      .notNull()
      .unique(),

    description: text(
      "description"
    ),

    categoryId: uuid(
      "category_id"
    ).references(
      () => categories.id,
      {
        onDelete: "set null",
      }
    ),

    brand: varchar("brand", {
      length: 200,
    }),

    costPriceCents: integer(
      "cost_price_cents"
    )
      .default(0)
      .notNull(),

    wholesalePriceCents: integer(
      "wholesale_price_cents"
    )
      .default(0)
      .notNull(),

    retailPriceCents: integer(
      "retail_price_cents"
    )
      .default(0)
      .notNull(),

    /*
     * For variant products this stores the
     * aggregate stock across all variants.
     */
    stockQuantity: integer(
      "stock_quantity"
    )
      .default(0)
      .notNull(),

    minimumOrderQuantity: integer(
      "minimum_order_quantity"
    )
      .default(1)
      .notNull(),

    caseQuantity: integer(
      "case_quantity"
    )
      .default(1)
      .notNull(),

    isActive: boolean(
      "is_active"
    )
      .default(true)
      .notNull(),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
      }
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
      }
    )
      .defaultNow()
      .notNull(),
  }
);

/*
 * =========================================================
 * PRODUCT IMAGES
 * =========================================================
 */

export const productImages =
  pgTable(
    "product_images",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      productId: uuid(
        "product_id"
      )
        .notNull()
        .references(
          () => products.id,
          {
            onDelete: "cascade",
          }
        ),

      url: text("url").notNull(),

      altText: varchar(
        "alt_text",
        {
          length: 255,
        }
      ),

      position: integer(
        "position"
      )
        .default(0)
        .notNull(),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index(
        "product_images_product_id_idx"
      ).on(table.productId),
    ]
  );

/*
 * =========================================================
 * PRODUCT VARIANTS
 * =========================================================
 */

export const productVariants =
  pgTable(
    "product_variants",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      productId: uuid(
        "product_id"
      )
        .notNull()
        .references(
          () => products.id,
          {
            onDelete: "cascade",
          }
        ),

      sku: varchar("sku", {
        length: 150,
      })
        .notNull()
        .unique(),

      barcode: varchar(
        "barcode",
        {
          length: 200,
        }
      ),

      option1Name: varchar(
        "option1_name",
        {
          length: 100,
        }
      ),

      option1Value: varchar(
        "option1_value",
        {
          length: 200,
        }
      ),

      option2Name: varchar(
        "option2_name",
        {
          length: 100,
        }
      ),

      option2Value: varchar(
        "option2_value",
        {
          length: 200,
        }
      ),

      option3Name: varchar(
        "option3_name",
        {
          length: 100,
        }
      ),

      option3Value: varchar(
        "option3_value",
        {
          length: 200,
        }
      ),

      costPriceCents: integer(
        "cost_price_cents"
      )
        .default(0)
        .notNull(),

      wholesalePriceCents:
        integer(
          "wholesale_price_cents"
        )
          .default(0)
          .notNull(),

      retailPriceCents: integer(
        "retail_price_cents"
      )
        .default(0)
        .notNull(),

      stockQuantity: integer(
        "stock_quantity"
      )
        .default(0)
        .notNull(),

      imageUrl: text(
        "image_url"
      ),

      isActive: boolean(
        "is_active"
      )
        .default(true)
        .notNull(),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .defaultNow()
        .notNull(),

      updatedAt: timestamp(
        "updated_at",
        {
          withTimezone: true,
        }
      )
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index(
        "product_variants_product_id_idx"
      ).on(table.productId),
    ]
  );

/*
 * =========================================================
 * ORDERS
 * =========================================================
 */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    /*
     * Human-readable number shown to the
     * buyer and admin.
     *
     * Example:
     * STM-20260916-A8F42C
     *
     * This will be generated by the
     * server-side place-order action.
     */
    orderNumber: varchar(
      "order_number",
      {
        length: 50,
      }
    )
      .notNull()
      .unique(),

    /*
     * Better Auth user ID.
     *
     * We intentionally don't create a
     * database foreign key here because
     * Better Auth manages its auth schema
     * independently from the store schema.
     */
    buyerUserId: varchar(
      "buyer_user_id",
      {
        length: 255,
      }
    ).notNull(),

    /*
     * Snapshot buyer information.
     *
     * These values stay attached to the
     * order even if the buyer later changes
     * their account information.
     */
    buyerEmail: varchar(
      "buyer_email",
      {
        length: 320,
      }
    ).notNull(),

    contactName: varchar(
      "contact_name",
      {
        length: 255,
      }
    ).notNull(),

    companyName: varchar(
      "company_name",
      {
        length: 255,
      }
    ).notNull(),

    phone: varchar("phone", {
      length: 100,
    }).notNull(),

    /*
     * Shipping address snapshot.
     */
    shippingAddressLine1:
      varchar(
        "shipping_address_line_1",
        {
          length: 500,
        }
      ).notNull(),

    shippingAddressLine2:
      varchar(
        "shipping_address_line_2",
        {
          length: 500,
        }
      ),

    shippingCity: varchar(
      "shipping_city",
      {
        length: 255,
      }
    ).notNull(),

    shippingState: varchar(
      "shipping_state",
      {
        length: 255,
      }
    ).notNull(),

    shippingPostalCode:
      varchar(
        "shipping_postal_code",
        {
          length: 100,
        }
      ).notNull(),

    shippingCountry: varchar(
      "shipping_country",
      {
        length: 255,
      }
    ).notNull(),

    /*
     * Buyer-supplied order instructions.
     */
    notes: text("notes"),

    /*
     * Monetary values are always stored in
     * integer cents.
     */
    subtotalCents: integer(
      "subtotal_cents"
    ).notNull(),

    shippingCents: integer(
      "shipping_cents"
    )
      .default(0)
      .notNull(),

    taxCents: integer(
      "tax_cents"
    )
      .default(0)
      .notNull(),

    totalCents: integer(
      "total_cents"
    ).notNull(),

    orderStatus:
      orderStatusEnum(
        "order_status"
      )
        .default("pending")
        .notNull(),

    paymentStatus:
      paymentStatusEnum(
        "payment_status"
      )
        .default("unpaid")
        .notNull(),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
      }
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
      }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index(
      "orders_buyer_user_id_idx"
    ).on(table.buyerUserId),

    index(
      "orders_created_at_idx"
    ).on(table.createdAt),

    index(
      "orders_order_status_idx"
    ).on(table.orderStatus),

    index(
      "orders_payment_status_idx"
    ).on(table.paymentStatus),
  ]
);

/*
 * =========================================================
 * ORDER ITEMS
 * =========================================================
 */

export const orderItems =
  pgTable(
    "order_items",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      orderId: uuid(
        "order_id"
      )
        .notNull()
        .references(
          () => orders.id,
          {
            onDelete: "cascade",
          }
        ),

      /*
       * References are nullable because an
       * order must survive even if a product
       * or variant is permanently deleted.
       */
      productId: uuid(
        "product_id"
      ).references(
        () => products.id,
        {
          onDelete: "set null",
        }
      ),

      variantId: uuid(
        "variant_id"
      ).references(
        () => productVariants.id,
        {
          onDelete: "set null",
        }
      ),

      /*
       * Product snapshot.
       */
      productName: varchar(
        "product_name",
        {
          length: 255,
        }
      ).notNull(),

      variantName: varchar(
        "variant_name",
        {
          length: 500,
        }
      ),

      sku: varchar("sku", {
        length: 150,
      }).notNull(),

      unitPriceCents: integer(
        "unit_price_cents"
      ).notNull(),

      quantity: integer(
        "quantity"
      ).notNull(),

      lineTotalCents: integer(
        "line_total_cents"
      ).notNull(),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index(
        "order_items_order_id_idx"
      ).on(table.orderId),

      index(
        "order_items_product_id_idx"
      ).on(table.productId),

      index(
        "order_items_variant_id_idx"
      ).on(table.variantId),
    ]
  );