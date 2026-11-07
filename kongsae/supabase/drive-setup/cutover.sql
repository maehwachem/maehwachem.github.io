begin;

-- Existing stored submissions remain readable. Old clients cannot write new binary data.
revoke execute on function public.ks_submit_photos(uuid,uuid,text,text[]),
  kongsae_private.ks_submit_photos(uuid,uuid,text,text[]) from authenticated;

commit;
