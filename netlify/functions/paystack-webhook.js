const admin = require("./_firebaseAdmin");
const axios = require("axios");

exports.handler = async function (event) {

  try {

    const body = JSON.parse(event.body);

    const eventType = body.event;

    // ONLY handle successful payments
    if (eventType !== "charge.success") {
      return { statusCode: 200, body: "ignored" };
    }

    const data = body.data;
    const email = data.customer.email;
    const amount = data.amount / 100; // convert kobo → Naira
    const reference = data.reference;

    // Find user by email
    const usersRef = admin.firestore().collection("users");
    const snapshot = await usersRef.where("email", "==", email).get();

    if (snapshot.empty) {
      return { statusCode: 404, body: "User not found" };
    }

    const userDoc = snapshot.docs[0];

    // Upgrade user
    await userDoc.ref.set({
      plan: "pro",
      upgradedAt: new Date(),
      lastPaymentRef: reference
    }, { merge: true });

    // Save transaction
    await admin.firestore().collection("transactions").add({
      email,
      amount,
      reference,
      status: "success",
      createdAt: new Date()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};