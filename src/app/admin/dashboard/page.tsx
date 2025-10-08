import AdminDashboard from '@/components/AdminDashboard';
import React, { Suspense } from 'react';


export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminDashboard />
    </Suspense>
  );
}
