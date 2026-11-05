-- Converge the current JSONB route to the approved ownership and privilege contract.
-- The same policy names exist on the baseline and the bridged live schema.
alter policy "Users can manage their own profile" on public.app_user
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "Users can manage their own daily records" on public.daily_record_store
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all privileges on public.app_user, public.daily_record_store
  from public, anon, authenticated;
grant select, insert, update on public.app_user to authenticated;
grant select, insert, update, delete on public.daily_record_store to authenticated;
