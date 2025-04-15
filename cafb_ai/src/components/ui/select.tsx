import * as React from 'react';

export function Select({
  onValueChange,
  defaultValue,
  children,
  className = '',
}: {
  onValueChange: (val: string) => void;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      onChange={(e) => onValueChange(e.target.value)}
      defaultValue={defaultValue}
    >
      {children}
    </select>
  );
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return <option value={value}>{children}</option>;
}
