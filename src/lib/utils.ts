import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ORDER_FORM_URL = process.env.ORDER_FORM_URL || "https://order.mottycrm.com";
export const TERMS_URL = `${ORDER_FORM_URL}/terms`;
export const PAYMENT_BASE_URL = process.env.PAYMENT_BASE_URL || process.env.AUTH_URL || "";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function calculateUpdateExpiryDate(purchaseDate: Date): Date {
  const expiry = new Date(purchaseDate);
  expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry;
}

export function isWithinUpdatePeriod(updateExpiryDate: Date): boolean {
  return new Date() <= updateExpiryDate;
}
