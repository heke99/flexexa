-- Run through the database test harness with flexexa.test_secret set by the caller.
-- Everything, including auth bootstrap, is rolled back. No email worker runs here.
begin;
do $test$
declare b jsonb; r jsonb; c integer; q uuid:=gen_random_uuid(); job jsonb;
begin
 b=jsonb_build_object('first_name','Tekniskt','last_name','Test','annual_miles',1500,'car','Testbil','privacy_version','applications-2026-11-02-v1','network_hash','transaction-test');
 begin perform public.flexexa_applications('stats','wrong');raise exception 'wrong secret allowed';exception when insufficient_privilege then null;end;
 update flexexa_acquisition.settings set new_count=906 where singleton;
 perform public.flexexa_applications('submit',current_setting('flexexa.test_secret'),b||'{"email":"boundary1000@example.invalid"}');
 if not exists(select 1 from flexexa_acquisition.applications where email='boundary1000@example.invalid' and position=1000 and offer_group='first_1000') then raise exception 'boundary1000 failed';end if;
 perform public.flexexa_applications('submit',current_setting('flexexa.test_secret'),b||'{"email":"boundary1001@example.invalid"}');
 if not exists(select 1 from flexexa_acquisition.applications where email='boundary1001@example.invalid' and position=1001 and offer_group='following') then raise exception 'boundary1001 failed';end if;
 r=public.flexexa_applications('submit',current_setting('flexexa.test_secret'),b||'{"email":"BOUNDARY1001@example.invalid"}');
 if r->>'created'<>'false' then raise exception 'duplicate failed';end if;
 select new_count into c from flexexa_acquisition.settings where singleton;
 if c<>908 then raise exception 'duplicate increment';end if;
 job=public.flexexa_applications('claim_email',current_setting('flexexa.test_secret'));
 if job->>'claim_token' is null then raise exception 'no claim';end if;
 r=public.flexexa_applications('finish_email',current_setting('flexexa.test_secret'),job||'{"claim_token":"00000000-0000-0000-0000-000000000000","outcome":"sent","provider_id":"stale-test"}');
 if r->>'updated'<>'0' then raise exception 'stale worker accepted';end if;
 perform public.flexexa_applications('finish_email',current_setting('flexexa.test_secret'),job||'{"outcome":"retry","error":"TEST_TIMEOUT"}');
 if not exists(select 1 from flexexa_acquisition.email_jobs where id=(job->>'id')::uuid and state='pending' and next_attempt_at>now()) then raise exception 'retry failed';end if;
 update flexexa_acquisition.email_jobs set next_attempt_at=now(),first_attempt_at=now()-interval '25 hours' where id=(job->>'id')::uuid;
 perform public.flexexa_applications('claim_email',current_setting('flexexa.test_secret'));
 if not exists(select 1 from flexexa_acquisition.email_jobs where id=(job->>'id')::uuid and state='review') then raise exception 'expired idempotency retry';end if;
 insert into auth.users(id,email,email_confirmed_at) values(q,'hekmat.h@div3rsa.com',now());
 perform set_config('request.jwt.claim.sub',q::text,true);
 perform public.flexexa_applications('owner_login',current_setting('flexexa.test_secret'));
 r=public.flexexa_applications('admin_list',current_setting('flexexa.test_secret'),'{"page":0}');
 if jsonb_array_length(r->'applications')<2 then raise exception 'admin listing failed';end if;
 update public.platform_memberships set status='suspended' where user_id=q;
 begin perform public.flexexa_applications('admin_list',current_setting('flexexa.test_secret'),'{"page":0}');raise exception 'suspended allowed';exception when insufficient_privilege then null;end;
end;$test$;
set local role anon;
do $test$ begin
 begin perform count(*) from flexexa_acquisition.applications;raise exception 'anon table access';exception when insufficient_privilege then null;end;
 perform public.flexexa_applications('stats',current_setting('flexexa.test_secret'));
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.flexexa_applications('admin_list',current_setting('flexexa.test_secret'),'{"page":0}');raise exception 'anon admin allowed';exception when insufficient_privilege then null;end;
end;$test$;
reset role;
rollback;
select 'PASS: boundaries, duplicate, secret, owner, suspended, anon, retry, stale worker, idempotency expiry; rolled back' as result;
