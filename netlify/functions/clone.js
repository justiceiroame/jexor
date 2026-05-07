const axios = require("axios");
const admin = require("./_firebaseAdmin");
const verifyUser = require("./auth");

exports.handler = async function (event) {

  try {

    const uid = await verifyUser(event);
    const userRef = admin.firestore().collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { statusCode: 403, body: "User not found" };
    }

    const user = userDoc.data();

    if (user.plan !== "pro") {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Pro plan required" })
      };
    }

    const { fileUrl, voiceName } = JSON.parse(event.body);

    if (!fileUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing audio file" })
      };
    }

    // ⚠️ REAL ELEVENLABS VOICE CLONE
    const response = await axios.post(
      "https://api.elevenlabs.io/v1/voices/add",
      {
        name: voiceName || "My Voice",
        files: [fileUrl]
      },
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY
        }
      }
    );

    const voiceId = response.data.voice_id;

    // Save voice
    await userRef.collection("voices").add({
      name: voiceName,
      voiceId,
      createdAt: new Date()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ voiceId })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};