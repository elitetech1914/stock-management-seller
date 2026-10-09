"use client";

import { useId, useState } from "react";
import { DropdownSelect } from "@/components/ui/dropdown-select";

type Props = {
  name: string;
  label: string;
  defaultValue: string;
  options: { label: string; value: string }[];
};

export function OrderSelect(props: Props) {
  // A refreshed server value starts a new draft without an effect-driven reset.
  return <OrderSelectField key={props.defaultValue} {...props} />;
}

function OrderSelectField({ name, label, defaultValue, options }: Props) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <label id={`${id}-label`} htmlFor={id} className="sr-only">{label}</label>
      <DropdownSelect
        id={id}
        labelledBy={`${id}-label`}
        value={value}
        options={options}
        onChange={setValue}
      />
    </div>
  );
}
