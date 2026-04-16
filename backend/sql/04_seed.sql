-- Demo customers (passwords = "password123")
INSERT INTO customers (name, email, phone, password_hash, kyc_status)
VALUES
  ('Arjun Sharma', 'arjun@demo.com', '9876543210',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'VERIFIED'),
  ('Priya Patel', 'priya@demo.com', '9876543211',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'VERIFIED');