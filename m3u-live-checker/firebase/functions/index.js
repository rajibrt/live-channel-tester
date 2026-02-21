import admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

export const playlist = onRequest({ region: "us-central1" }, async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }

    const rawPath = (req.path || "").trim();
    const match = rawPath.match(/\/playlist\/([a-zA-Z0-9-]+)\.m3u$/);
    if (!match) {
      res.status(400).send("Invalid playlist path");
      return;
    }

    const slug = match[1];
    const doc = await db.collection("playlists_public").doc(slug).get();
    if (!doc.exists) {
      res.status(404).send("Playlist not found");
      return;
    }

    const data = doc.data() || {};
    const storagePath = data.storagePath || `playlists/${slug}/current.m3u`;
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).send("Playlist file not found");
      return;
    }

    const [content] = await file.download();
    res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).send(content.toString("utf-8"));
  } catch (err) {
    res.status(500).send(`Server error: ${err?.message || "unknown"}`);
  }
});
