const admin = require("./_firebaseAdmin");

module.exports = async function verifyUser(event) {
  const token = event.headers.authorization?.split("Bearer ")[1];

  if (!token) throw new Error("No auth token");

  const decoded = await admin.auth().verifyIdToken(token);

  return decoded.uid;
};