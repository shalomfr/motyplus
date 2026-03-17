"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OrderCancelPage() {
  const router = useRouter();

  return (
    <div className="py-12">
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <XCircle className="h-16 w-16 text-yellow-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800">
            התשלום בוטל
          </h2>
          <p className="text-muted-foreground">
            ההזמנה לא הושלמה. תוכלו לחזור ולנסות שוב.
          </p>
          <div className="pt-4">
            <Button onClick={() => router.push("/order")}>
              חזרה לטופס ההזמנה
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
