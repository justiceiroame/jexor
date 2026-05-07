const axios = require("axios");
const admin = require("./_firebaseAdmin");
const verifyUser = require("./auth");

exports.handler = async function (event) {

  try {

    const uid = await verifyUser(event);

    const userRef = admin.firestore().collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "User not found" })
      };
    }

    const user = userDoc.data();

    // 🔒 PRO CHECK
    if (user.plan !== "pro") {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Upgrade required" })
      };
    }

    const { text, voiceId } = JSON.parse(event.body);

    if (!text || !voiceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing text or voiceId" })
      };
    }

    // 🔥 DAILY LIMIT (4)
    const today = new Date().toDateString();
    if (user.lastTtsDay !== today) {
      await userRef.set({
        ttsUsedToday: 0,
        lastTtsDay: today
      }, { merge: true });
      user.ttsUsedToday = 0;
    }

    if ((user.ttsUsedToday || 0) >= 4) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Daily limit reached" })
      };
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: "eleven_multilingual_v2"
      },
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer"
      }
    );

    const audioBase64 = Buffer.from(response.data).toString("base64");

    // 📊 UPDATE USAGE
    await userRef.set({
      ttsUsedToday: admin.firestore.FieldValue.increment(1)
    }, { merge: true });

    return {
      statusCode: 200,
      body: JSON.stringify({
        audio: `data:audio/mpeg;base64,${audioBase64}`
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};