import Image from "next/image";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white font-heebo">
      <header className="py-6 text-center border-b bg-white/80 backdrop-blur-sm">
        <Image
          src="/logo.png"
          alt="Motty Beats"
          width={140}
          height={48}
          className="mx-auto"
          priority
        />
        <p className="text-sm text-muted-foreground mt-2">
          סטים, ריתמוסים ועדכוני תוכנה לקלידים
        </p>
      </header>
      <main className="container mx-auto max-w-2xl px-4 py-8">{children}</main>
      <footer className="text-center py-6 text-xs text-muted-foreground border-t">
        Motty Beats &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
