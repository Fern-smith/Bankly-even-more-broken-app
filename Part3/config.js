require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY || "secret-dev-key";
const BCRYPT_WORK_FACTOR = 12;

const DB_URI = process.env.NODE_ENV === "test"
  ? "postgresql:///bankly_test"
  : "postgresql:///bankly";

module.exports = {
  SECRET_KEY,
  BCRYPT_WORK_FACTOR,
  DB_URI
};
