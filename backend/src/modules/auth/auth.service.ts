import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pg } from '../../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

export async function login(email: string, passwordPlain: string) {
  const { rows } = await pg.query(`SELECT * FROM users WHERE email=$1`, [email]);
  const user = rows[0];

  if (!user) throw new Error('Invalid email or password');

  const isValid = await bcrypt.compare(passwordPlain, user.password_hash);
  if (!isValid) throw new Error('Invalid email or password');

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  };
}

// YEH NAYA FUNCTION HAI
export async function seedDefaultAdmin() {
  try {
    const { rows } = await pg.query(`SELECT COUNT(*) FROM users`);
    if (Number(rows[0].count) > 0) {
      console.log('✅ Admin user already exists');
      return;
    }

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      console.log('⚠️ ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping admin seed.');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await pg.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
      ['Admin', email, hash]
    );

    console.log(`✅ Default Admin created: ${email}`);
  } catch (err) {
    console.error('❌ Failed to seed admin:', err);
  }
}