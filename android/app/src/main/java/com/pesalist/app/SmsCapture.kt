package com.pesalist.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Durable queue for raw captured SMS messages.
 * Native side ONLY captures + stores raw text/sender/timestamp here.
 * All parsing (smsMatcher.js logic) stays in JS — this just guarantees
 * nothing gets lost if the app process is killed in the background.
 */
object SmsCapture {
    private const val PREFS_NAME = "pesa_list_sms_queue"
    private const val KEY_QUEUE = "queue"
    private const val MAX_QUEUE_SIZE = 500 // safety cap

    @Synchronized
    fun enqueue(context: Context, sender: String, body: String, timestamp: Long) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_QUEUE, "[]")
        val arr = JSONArray(existing)

        val entry = JSONObject()
        entry.put("originatingAddress", sender)
        entry.put("body", body)
        entry.put("timestamp", timestamp)
        arr.put(entry)

        // Trim oldest if we somehow overflow (shouldn't happen in normal use)
        val trimmed = if (arr.length() > MAX_QUEUE_SIZE) {
            val start = arr.length() - MAX_QUEUE_SIZE
            val newArr = JSONArray()
            for (i in start until arr.length()) newArr.put(arr.get(i))
            newArr
        } else arr

        prefs.edit().putString(KEY_QUEUE, trimmed.toString()).apply()
    }

    @Synchronized
    fun drainAll(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_QUEUE, "[]") ?: "[]"
        // Clear immediately after reading so JS "owns" these once returned
        prefs.edit().putString(KEY_QUEUE, "[]").apply()
        return existing
    }

    @Synchronized
    fun peekAll(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_QUEUE, "[]") ?: "[]"
    }
}
