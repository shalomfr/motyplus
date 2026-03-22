export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-950 flex items-center justify-center p-4"
      dir="rtl"
    >
      {children}
    </div>
  );
}
