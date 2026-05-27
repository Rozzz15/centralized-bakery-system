-- Default Accounts for BakeFlow ERP
-- Run this separately after the initial schema is already set up.

-- Create default auth users if they don't already exist
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  t.email,
  crypt(t.password, gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('display_name', t.display_name, 'role', t.role),
  now(),
  now(),
  '',
  '',
  '',
  ''
from (values
  ('admin1@bakeflow.com',   'Admin@123',  'Admin 1',  'admin'),
  ('admin2@bakeflow.com',   'Admin@123',  'Admin 2',  'admin'),
  ('baker@bakeflow.com',    'Baker@123',  'Baker',    'baker'),
  ('deco@bakeflow.com',     'Deco@123',   'Deco',     'deco'),
  ('kitchen@bakeflow.com',  'Kitchen@123','Kitchen',  'kitchen'),
  ('branch@bakeflow.com',   'Branch@123', 'Branch',   'branch')
) as t(email, password, display_name, role)
where not exists (select 1 from auth.users where auth.users.email = t.email);

-- Create identities so the users can sign in with email provider
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.email in ('admin1@bakeflow.com','admin2@bakeflow.com','baker@bakeflow.com','deco@bakeflow.com','kitchen@bakeflow.com','branch@bakeflow.com')
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

-- Update the auto-created profiles with the correct role and display name
update public.profiles p
set
  display_name = u.raw_user_meta_data->>'display_name',
  role = u.raw_user_meta_data->>'role'
from auth.users u
where p.id = u.id
  and u.email in ('admin1@bakeflow.com','admin2@bakeflow.com','baker@bakeflow.com','deco@bakeflow.com','kitchen@bakeflow.com','branch@bakeflow.com');
