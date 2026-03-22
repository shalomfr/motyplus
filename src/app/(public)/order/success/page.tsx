import { CheckCircle2 } from "lucide-react";
import { ProcessPayment } from "./process-payment";

export default function OrderSuccessPage() {
  return (
    <div className="text-center py-12 space-y-6">
      <div className="flex justify-center">
        <div className="bg-green-100 rounded-full p-4">
          <CheckCircle2 className="h-16 w-16 text-green-600" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">
          התשלום בוצע בהצלחה!
        </h2>
        <p className="text-gray-600 text-lg">
          תודה על הרכישה. ההזמנה שלך התקבלה ותטופל בהקדם.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-right space-y-3 max-w-md mx-auto">
        <p className="text-sm text-gray-600">
          חשבונית/קבלה נשלחה לכתובת המייל שהזנת.
        </p>
        <p className="text-sm text-gray-600">
          ניצור איתך קשר בהקדם עם פרטים נוספים לגבי ההזמנה.
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-8">
        לשאלות ובירורים ניתן לפנות אלינו בכל עת
      </p>

      {/* Process payment from URL params as fallback if webhook didn't fire */}
      <ProcessPayment />
    </div>
  );
}
