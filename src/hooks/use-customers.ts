"use client";

import { useState, useEffect, useCallback } from "react";

interface CustomerFilters {
  search?: string;
  organId?: string;
  setTypeId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  missingDetails?: boolean;
  page?: number;
  limit?: number;
}

interface Customer {
  id: number;
  fullName: string;
  phone: string;
  whatsappPhone: string | null;
  address: string | null;
  email: string;
  purchaseDate: string;
  updateExpiryDate: string;
  organId: string;
  setTypeId: string;
  amountPaid: number;
  status: string;
  sampleType: string;
  currentUpdateVersion: string | null;
  hasV3: boolean;
  notes: string | null;
  linkedCustomerId: number | null;
  organ: { id: string; name: string };
  setType: { id: string; name: string; price: number };
  createdAt: string;
}

interface UseCustomersReturn {
  customers: Customer[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCustomers(filters: CustomerFilters = {}): UseCustomersReturn {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.organId) params.set("organId", filters.organId);
    if (filters.setTypeId) params.set("setTypeId", filters.setTypeId);
    if (filters.status) params.set("status", filters.status);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.missingDetails) params.set("missingDetails", "true");
    params.set("page", String(filters.page || 1));
    params.set("limit", String(filters.limit || 20));

    try {
      const res = await fetch(`/api/customers?${params.toString()}`);
      if (!res.ok) throw new Error("שגיאה בטעינת לקוחות");
      const data = await res.json();
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.organId,
    filters.setTypeId,
    filters.status,
    filters.dateFrom,
    filters.dateTo,
    filters.missingDetails,
    filters.page,
    filters.limit,
  ]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return { customers, total, loading, error, refetch: fetchCustomers };
}
