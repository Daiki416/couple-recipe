import { LogoutButton } from "@/components/auth/LogoutButton";
import { createClient } from "@/lib/supabase/server";
import {
  DeleteAccountForm,
  DisplayNameForm,
  EmailForm,
  HouseholdForm,
  PasswordForm,
} from "@/components/settings/SettingsForms";
import { cardClass } from "@/lib/ui";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_name, household_id")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const { data: household } = profile?.household_id
    ? await supabase
        .from("households")
        .select("name")
        .eq("id", profile.household_id)
        .maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="mb-6 font-round text-2xl font-bold text-ink">設定</h1>

      <div className="flex flex-col gap-5">
        <DisplayNameForm defaultName={profile?.display_name ?? ""} />
        <HouseholdForm defaultName={household?.name ?? ""} />
        <EmailForm currentEmail={user?.email ?? ""} />
        <PasswordForm />

        <section className={`${cardClass} p-5`}>
          <h2 className="font-round text-lg font-bold text-ink">ログアウト</h2>
          <p className="mt-1 text-sm text-ink-soft">
            この端末からサインアウトします。
          </p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </section>

        <DeleteAccountForm />
      </div>
    </main>
  );
}
