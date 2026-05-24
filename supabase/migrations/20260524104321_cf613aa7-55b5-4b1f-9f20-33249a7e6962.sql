
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.apply_elo(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.find_or_join_match(text, int) from public, anon;
grant execute on function public.find_or_join_match(text, int) to authenticated;
