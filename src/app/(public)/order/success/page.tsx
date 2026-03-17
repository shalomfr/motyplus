"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export default function OrderSuccessPage() {
  return (
    <div className="py-12">
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800">
            ההזמנה התקבלה בהצלחה!
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            תודה על הרכישה. קובץ האינפו שלך הועלה והחשבון שלך נוצר במערכת.
            ניצור איתך קשר בהקדם.
          </p>
          <div className="pt-4">
            <a
              href="/order"
              className="text-blue-600 hover:underline text-sm"
            >
              חזרה לדף ההזמנה
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
