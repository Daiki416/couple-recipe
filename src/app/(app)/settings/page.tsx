import { LogoutButton } from "@/components/auth/LogoutButton";

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">設定</h1>
      <LogoutButton />
    </main>
  );
}
