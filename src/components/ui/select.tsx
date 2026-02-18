"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

type SelectContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
};

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error("Select components must be used within <Select />");
  }
  return context;
}

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  children: ReactNode;
};

export function Select({
  value,
  onValueChange,
  name,
  disabled,
  children,
}: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onValueChange, name, disabled }}>
      {children}
    </SelectContext.Provider>
  );
}

type SelectTriggerProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "name"> & {
  children: ReactNode;
};

export function SelectTrigger({
  className,
  children,
  ...props
}: SelectTriggerProps) {
  const { value, onValueChange, name, disabled } = useSelectContext();
  return (
    <select
      className={className ?? "form-select"}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      name={name}
      disabled={disabled}
      {...props}
    >
      {children}
    </select>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return placeholder ? <option value="">{placeholder}</option> : null;
}

export function SelectContent({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

type SelectItemProps = {
  value: string;
  disabled?: boolean;
  children: ReactNode;
};

export function SelectItem({ value, disabled = false, children }: SelectItemProps) {
  return (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  );
}
