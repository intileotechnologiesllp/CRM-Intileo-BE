-- Create Admin Master User
-- Login credentials: admin@intileo.com / Admin@123

INSERT INTO MasterUsers (
  name,
  email,
  password,
  mobileNumber,
  designation,
  department,
  creatorId,
  createdBy,
  status,
  loginType,
  userType,
  isActive,
  resetToken,
  resetTokenExpiry,
  createdAt,
  updatedAt
) VALUES (
  'Super Admin',
  'admin@intileo.com',
  '$2b$10$ojWh9xKUvAZgfdo6x24jTODQsysh6RvHtWWmVuAgQL0GtEpAxnFZi',
  '1234567890',
  NULL,
  NULL,
  1,
  'System',
  'active',
  'admin',
  'admin',
  TRUE,
  NULL,
  NULL,
  NOW(),
  NOW()
);

-- Verify the user was created
SELECT masterUserID, name, email, userType, loginType, isActive 
FROM MasterUsers 
WHERE email = 'admin@intileo.com';
