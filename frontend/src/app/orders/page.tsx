import { Suspense } from "react";
import { OrdersScreen } from "@/components/orders/orders-screen";
export default function OrdersPage() { return <Suspense fallback={null}><OrdersScreen /></Suspense>; }
