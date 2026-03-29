import 'dotenv/config'

const required = [
'PORT',
'NODE_ENV',
'DATABASE_URL',
'DB_APP_USER',
'DB_APP_PASSWORD',
'DB_APP_URL',
'JWT_ACCESS_SECRET',
'JWT_REFRESH_SECRET',
'CORS_ORIGIN',
]

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  port: parseInt(process.env.PORT, 10),  // radix 10 for base-10
  env: process.env.NODE_ENV,

  db: {
    appUrl: process.env.DB_APP_URL,
    appUser: process.env.DB_APP_USER,
    appPassword: process.env.DB_APP_PASSWORD,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN,
  },
};
