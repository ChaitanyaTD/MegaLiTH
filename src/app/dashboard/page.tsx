"use client";
import Dashboard from "@/components/Dashboard";
import React, { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Dashboard />
    </Suspense>
  );
}
