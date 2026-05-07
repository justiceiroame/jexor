const admin = require("./_firebaseAdmin");
const axios = require("axios");
const verifyUser = require("./auth");

exports.handler = async function (event) {

  try {

    // 🔐 VERIFY FIREBASE USER (SECURE UID)
    const uid = await verifyUser(event);

    const { reference } = JSON.parse(event.body);

    if (!reference) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No payment reference provided" })
      };
    }

    // 💳 VERIFY PAYMENT WITH PAYSTACK (SERVER SIDE ONLY)
    const verify = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const data = verify.data.data;

    // ❌ PAYMENT NOT SUCCESSFUL
    if (!data || data.status !== "success") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Payment verification failed" })
      };
    }

    // 💰 OPTIONAL: VERIFY CORRECT AMOUNT (₦8,400)
    if (data.amount !== 840000) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid payment amount" })
      };
    }

    // 🔐 UPDATE USER PLAN IN FIREBASE
    await admin.firestore()
      .collection("users")
      .doc(uid)
      .set({
        plan: "pro",
        upgradedAt: new Date(),
        paystackReference: reference
      }, { merge: true });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "User upgraded to Pro"
      })
    };

  } catch (err) {

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };

  }
};