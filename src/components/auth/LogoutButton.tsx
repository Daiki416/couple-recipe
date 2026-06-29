import { logout } from "@/app/(auth)/actions";
import { outlineButtonClass } from "@/lib/ui";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className={outlineButtonClass}>
        ログアウト
      </button>
    </form>
  );
}
