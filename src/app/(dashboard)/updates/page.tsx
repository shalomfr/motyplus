"use client"

import { useRouter } from "next/navigation"
import { List, Plus } from "lucide-react"

export default function UpdatesPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">עדכונים</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* רשימת עדכונים */}
        <button
          onClick={() => router.push("/updates/list")}
          className="group flex flex-col items-center gap-3 sm:gap-4 p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-400 hover:shadow-lg transition-all text-center"
        >
          <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-100 group-hover:bg-gray-200 transition-colors">
            <List className="h-7 w-7 sm:h-8 sm:w-8 text-gray-600" />
          </div>
          <div>
            <div className="text-base sm:text-lg font-semibold text-gray-800">רשימת עדכונים</div>
            <div className="text-sm text-muted-foreground mt-1">צפה בכל העדכונים שנוצרו</div>
          </div>
        </button>

        {/* צור עדכון חדש */}
        <button
          onClick={() => router.push("/updates/wizard")}
          className="group flex flex-col items-center gap-3 sm:gap-4 p-6 sm:p-8 rounded-2xl border-2 border-blue-200 bg-white hover:border-orange-400 hover:shadow-lg transition-all text-center"
        >
          <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-orange-100 group-hover:bg-blue-200 transition-colors">
            <Plus className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
          </div>
          <div>
            <div className="text-base sm:text-lg font-semibold text-blue-800">צור עדכון חדש</div>
            <div className="text-sm text-muted-foreground mt-1">אשף יצירת עדכון חדש</div>
          </div>
        </button>
      </div>
    </div>
  )
}
