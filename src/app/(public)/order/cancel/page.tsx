import { XCircle } from "lucide-react";

export default function OrderCancelPage() {
  return (
    <div className="text-center py-12 space-y-6">
      <div className="flex justify-center">
        <div className="bg-red-100 rounded-full p-4">
          <XCircle className="h-16 w-16 text-red-500" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">
          התשלום בוטל
        </h2>
        <p className="text-gray-600 text-lg">
          ההזמנה לא הושלמה. לא בוצע חיוב.
        </p>
      </div>

      <p className="text-sm text-gray-500">
        ניתן לחזור לדף ההזמנה ולנסות שוב בכל עת.
      </p>
    </div>
  );
}
