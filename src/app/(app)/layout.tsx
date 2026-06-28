import { AppNav } from "@/components/layout/AppNav";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1">
      <AppNav />
      <div className="flex flex-1 flex-col pb-16 md:pb-0">{children}</div>
    </div>
  );
}
