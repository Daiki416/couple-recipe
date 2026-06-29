-- households_update の RLS 再帰バグ修正
-- 症状: authenticated ユーザーが世帯名(name)を更新すると 500
--       42P17: infinite recursion detected in policy for relation "households"
-- 原因: 20260627143536_harden_rls.sql の households_update ポリシー with check が
--       invite_code の不変性を担保するため households 自身を SELECT しており、
--       UPDATE 時の check 評価で households の RLS が再帰的に評価される。
-- 方針: invite_code（および id / created_at）の不変性は「列レベル UPDATE 権限」で担保し、
--       ポリシーからは自己参照サブクエリを除去する（所属世帯であることだけを check）。
--       current_household_id() は SECURITY DEFINER のため再帰しない。

-- =============================================================
-- 1. 列レベル権限: authenticated は name 列のみ更新可能にする
--    （invite_code / id / created_at を実質的に不変化）
-- =============================================================
revoke update on public.households from authenticated;
grant update (name) on public.households to authenticated;

-- =============================================================
-- 2. households_update ポリシー貼り替え（再帰サブクエリを除去）
-- =============================================================
drop policy "households_update" on public.households;
create policy "households_update" on public.households
  for update
  to authenticated
  using (id = (select public.current_household_id()))
  with check (id = (select public.current_household_id()));
