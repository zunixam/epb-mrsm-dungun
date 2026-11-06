// Used only by the interactive operator CLI, never exposed through an HTTP endpoint.
export const FIRST_ADMIN_SQL = 'INSERT INTO admin_users (id,email,password_hash) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM admin_users) RETURNING id';
