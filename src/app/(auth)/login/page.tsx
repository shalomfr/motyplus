"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "נא להזין כתובת אימייל")
    .email("כתובת אימייל לא תקינה"),
  password: z
    .string()
    .min(1, "נא להזין סיסמה")
    .min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError("");

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setServerError("אימייל או סיסמה שגויים");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setServerError("אירעה שגיאה בהתחברות. נסה שנית.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">M+</span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-2">
          אורגנים ומקצבים
        </h1>
        <p className="text-center text-gray-600 mb-8">
          מערכת ניהול
        </p>
        <h2 className="text-xl font-bold text-gray-800 text-center mb-6">
          התחברות למערכת
        </h2>

        {/* Server error */}
        {serverError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              אימייל
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              className={cn(
                "w-full px-4 py-2.5 border rounded-lg text-sm transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                "placeholder:text-gray-400",
                errors.email
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300 bg-white"
              )}
              placeholder="your@email.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-500">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              סיסמה
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                dir="ltr"
                className={cn(
                  "w-full px-4 py-2.5 border rounded-lg text-sm transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  "placeholder:text-gray-400 pl-10",
                  errors.password
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300 bg-white"
                )}
                placeholder="הזן סיסמה"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors",
              "bg-blue-600 hover:bg-blue-700 text-white",
              "disabled:bg-gray-400 disabled:cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>מתחבר...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>התחבר</span>
              </>
            )}
          </button>
        </form>
      </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © אורגנים ומקצבים — מערכת ניהול לקוחות
        </p>
    </div>
  );
}
