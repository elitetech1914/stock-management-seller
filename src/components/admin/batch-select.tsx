"use client";

import type { ComponentProps } from "react";
import { DropdownSelect } from "@/components/ui/dropdown-select";

export function BatchSelect(props: ComponentProps<typeof DropdownSelect>) {
  return <DropdownSelect {...props} />;
}
