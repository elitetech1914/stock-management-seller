"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Building2,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Package,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { placeOrder } from "@/app/checkout/actions";
import { useCart } from "@/lib/cart";

type CheckoutFormProps = {
  buyerUserId: string;
  buyerName: string;
  buyerEmail: string;
};

type CheckoutDetails = {
  contactName: string;
  companyName: string;
  phone: string;

  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;

  notes: string;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function CheckoutForm({
  buyerUserId,
  buyerName,
  buyerEmail,
}: CheckoutFormProps) {
  const {
    items,
    subtotalCents,
    clearCart,
  } = useCart();

  const storageKey = useMemo(
    () =>
      `stockmora-checkout-details-v1:${buyerUserId}`,
    [buyerUserId]
  );

  const [mounted, setMounted] =
    useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    details,
    setDetails,
  ] = useState<CheckoutDetails>({
    contactName: buyerName,
    companyName: "",
    phone: "",

    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States",

    notes: "",
  });

  useEffect(() => {
    setMounted(true);

    try {
      const stored =
        window.localStorage.getItem(
          storageKey
        );

      if (!stored) {
        return;
      }

      const parsed =
        JSON.parse(
          stored
        ) as Partial<CheckoutDetails>;

      setDetails((current) => ({
        ...current,
        ...parsed,

        contactName:
          parsed.contactName ||
          current.contactName,
      }));
    } catch {
      // Ignore invalid stored data.
    }
  }, [storageKey]);

  function updateField(
    field: keyof CheckoutDetails,
    value: string
  ) {
    setError("");

    setDetails((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify(next)
        );
      } catch {
        // Checkout can continue even if
        // localStorage is unavailable.
      }

      return next;
    });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");

    if (items.length === 0) {
      setError(
        "Your cart is empty. Add products before placing an order."
      );

      return;
    }

    if (!details.contactName.trim()) {
      setError(
        "Please enter the contact name."
      );
      return;
    }

    if (!details.companyName.trim()) {
      setError(
        "Please enter the business or company name."
      );
      return;
    }

    if (!details.phone.trim()) {
      setError(
        "Please enter a phone number."
      );
      return;
    }

    if (!details.addressLine1.trim()) {
      setError(
        "Please enter the shipping address."
      );
      return;
    }

    if (!details.city.trim()) {
      setError(
        "Please enter the city."
      );
      return;
    }

    if (!details.state.trim()) {
      setError(
        "Please enter the state or region."
      );
      return;
    }

    if (!details.postalCode.trim()) {
      setError(
        "Please enter the postal code."
      );
      return;
    }

    if (!details.country.trim()) {
      setError(
        "Please enter the country."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        await placeOrder({
          details,

          /*
           * Never send prices from the
           * browser as authoritative data.
           */
          items: items.map(
            (item) => ({
              productId:
                item.productId,

              variantId:
                item.variantId,

              quantity:
                item.quantity,
            })
          ),
        });

      if (!result.ok) {
        setError(
          result.error
        );

        return;
      }

      /*
       * The database transaction succeeded,
       * so the local cart can now be removed.
       */
      clearCart();

      try {
        window.localStorage.removeItem(
          storageKey
        );
      } catch {
        // Non-critical cleanup failure.
      }

      window.location.assign(
        `/orders/${encodeURIComponent(
          result.orderNumber
        )}/success`
      );
    } catch {
      setError(
        "Something went wrong while placing your order. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mounted) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[560px] animate-pulse rounded-2xl bg-neutral-100" />

        <div className="h-[360px] animate-pulse rounded-2xl bg-neutral-100" />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="space-y-5">
        {/* BUYER ACCOUNT */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2
                size={18}
              />
            </div>

            <div>
              <h2 className="font-semibold text-neutral-950">
                Buyer account
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                Signed in as{" "}
                <span className="font-medium text-neutral-700">
                  {buyerEmail}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* BUSINESS DETAILS */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f2ee]">
              <Building2
                size={18}
              />
            </div>

            <div>
              <h2 className="font-semibold text-neutral-950">
                Business details
              </h2>

              <p className="text-sm text-neutral-500">
                Who should we contact about
                this wholesale order?
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Contact name"
              value={
                details.contactName
              }
              onChange={(value) =>
                updateField(
                  "contactName",
                  value
                )
              }
              placeholder="John Smith"
              icon={
                <UserRound
                  size={15}
                />
              }
            />

            <Field
              label="Company name"
              value={
                details.companyName
              }
              onChange={(value) =>
                updateField(
                  "companyName",
                  value
                )
              }
              placeholder="Smith Retail LLC"
              icon={
                <Building2
                  size={15}
                />
              }
            />

            <Field
              label="Phone"
              value={details.phone}
              onChange={(value) =>
                updateField(
                  "phone",
                  value
                )
              }
              placeholder="+1 555 123 4567"
              className="sm:col-span-2"
            />
          </div>
        </section>

        {/* SHIPPING */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f2ee]">
              <MapPin
                size={18}
              />
            </div>

            <div>
              <h2 className="font-semibold text-neutral-950">
                Shipping address
              </h2>

              <p className="text-sm text-neutral-500">
                Enter the destination for
                this order.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Address"
              value={
                details.addressLine1
              }
              onChange={(value) =>
                updateField(
                  "addressLine1",
                  value
                )
              }
              placeholder="123 Main Street"
              className="sm:col-span-2"
            />

            <Field
              label="Apartment, suite, etc."
              value={
                details.addressLine2
              }
              onChange={(value) =>
                updateField(
                  "addressLine2",
                  value
                )
              }
              placeholder="Suite 200"
              required={false}
              className="sm:col-span-2"
            />

            <Field
              label="City"
              value={details.city}
              onChange={(value) =>
                updateField(
                  "city",
                  value
                )
              }
              placeholder="Houston"
            />

            <Field
              label="State / Region"
              value={details.state}
              onChange={(value) =>
                updateField(
                  "state",
                  value
                )
              }
              placeholder="Texas"
            />

            <Field
              label="Postal code"
              value={
                details.postalCode
              }
              onChange={(value) =>
                updateField(
                  "postalCode",
                  value
                )
              }
              placeholder="77001"
            />

            <Field
              label="Country"
              value={
                details.country
              }
              onChange={(value) =>
                updateField(
                  "country",
                  value
                )
              }
              placeholder="United States"
            />
          </div>
        </section>

        {/* NOTES */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <label
            htmlFor="order-notes"
            className="text-sm font-semibold text-neutral-950"
          >
            Order notes
          </label>

          <p className="mt-1 text-sm text-neutral-500">
            Optional instructions or
            information for this order.
          </p>

          <textarea
            id="order-notes"
            value={details.notes}
            onChange={(event) =>
              updateField(
                "notes",
                event.target.value
              )
            }
            rows={4}
            placeholder="Special delivery instructions, purchasing reference, etc."
            className="mt-4 w-full resize-none rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[#17352c] focus:ring-1 focus:ring-[#17352c]"
          />
        </section>
      </div>

      {/* ORDER SUMMARY */}
      <aside className="lg:sticky lg:top-5 lg:self-start">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100">
              <ShoppingBag
                size={17}
              />
            </div>

            <div>
              <h2 className="font-semibold text-neutral-950">
                Order summary
              </h2>

              <p className="text-xs text-neutral-500">
                {items.length}{" "}
                {items.length === 1
                  ? "product"
                  : "products"}
              </p>
            </div>
          </div>

          <div className="mt-5 max-h-[330px] space-y-4 overflow-y-auto border-y border-neutral-200 py-4">
            {items.length === 0 ? (
              <div className="py-6 text-center">
                <Package
                  size={25}
                  className="mx-auto text-neutral-300"
                />

                <p className="mt-2 text-sm text-neutral-500">
                  Your cart is empty.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.lineId}
                  className="flex gap-3"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    {item.imageUrl ? (
                      <img
                        src={
                          item.imageUrl
                        }
                        alt={
                          item.productName
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package
                          size={17}
                          className="text-neutral-400"
                        />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-neutral-950">
                      {item.productName}
                    </p>

                    {item.variantName && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
                        {item.variantName}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-neutral-500">
                      Qty{" "}
                      {item.quantity} ×{" "}
                      {formatMoney(
                        item.priceCents
                      )}
                    </p>
                  </div>

                  <p className="shrink-0 text-sm font-semibold text-neutral-900">
                    {formatMoney(
                      item.priceCents *
                        item.quantity
                    )}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="py-5">
            <div className="flex justify-between text-sm text-neutral-600">
              <span>
                Subtotal
              </span>

              <span className="font-semibold text-neutral-950">
                {formatMoney(
                  subtotalCents
                )}
              </span>
            </div>

            <div className="mt-3 flex justify-between border-t border-neutral-200 pt-4">
              <span className="font-semibold text-neutral-950">
                Estimated total
              </span>

              <span className="text-lg font-semibold text-neutral-950">
                {formatMoney(
                  subtotalCents
                )}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              items.length === 0 ||
              isSubmitting
            }
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
                Placing order...
              </>
            ) : (
              "Place order"
            )}
          </button>

          <p className="mt-3 text-xs leading-5 text-neutral-500">
            No online payment will be
            collected. Your order will be
            submitted as{" "}
            <span className="font-medium text-neutral-700">
              Pending
            </span>{" "}
            with payment status{" "}
            <span className="font-medium text-neutral-700">
              Unpaid
            </span>
            .
          </p>
        </div>
      </aside>
    </form>
  );
}

type FieldProps = {
  label: string;
  value: string;

  onChange: (
    value: string
  ) => void;

  placeholder?: string;
  required?: boolean;
  className?: string;
  icon?: React.ReactNode;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = true,
  className = "",
  icon,
}: FieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-neutral-800">
        {label}

        {!required && (
          <span className="ml-1 font-normal text-neutral-400">
            optional
          </span>
        )}
      </label>

      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
            {icon}
          </div>
        )}

        <input
          type="text"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          placeholder={placeholder}
          required={required}
          disabled={false}
          className={`h-11 w-full rounded-xl border border-neutral-300 bg-white pr-4 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[#17352c] focus:ring-1 focus:ring-[#17352c] ${
            icon
              ? "pl-10"
              : "pl-4"
          }`}
        />
      </div>
    </div>
  );
}