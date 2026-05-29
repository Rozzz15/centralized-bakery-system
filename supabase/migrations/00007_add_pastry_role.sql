-- Add Pastry role account

-- Create auth user
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'pastry@bakeflow.com',
  crypt('Pastry@123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('display_name', 'Pastry', 'role', 'pastry'),
  now(),
  now(),
  '',
  '',
  '',
  ''
where not exists (select 1 from auth.users where email = 'pastry@bakeflow.com');

-- Create identity for sign-in
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
where u.email = 'pastry@bakeflow.com'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

-- Update profile with correct role and display name
update public.profiles p
set
  display_name = u.raw_user_meta_data->>'display_name',
  role = u.raw_user_meta_data->>'role'
from auth.users u
where p.id = u.id
  and u.email = 'pastry@bakeflow.com';
