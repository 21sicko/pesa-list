package com.pesalist.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.SmsMessage

/**
 * Registered STATICALLY in AndroidManifest.xml (not at runtime), so Android
 * will wake up / spin up the app process just to deliver this broadcast,
 * even if the app was fully killed. This is what react-native-android-sms-listener
 * could NOT do, since it only registers dynamically while JS is alive.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "android.provider.Telephony.SMS_RECEIVED") return

        try {
            val messages = getMessagesFromIntent(intent)
            for (msg in messages) {
                val sender = msg.originatingAddress ?: continue
                val body = msg.messageBody ?: continue
                val timestamp = msg.timestampMillis

                // 1. Persist immediately — this is the notebook, never skipped.
                SmsCapture.enqueue(context, sender, body, timestamp)
            }
        } catch (e: Exception) {
            // Swallowing here would hide bugs silently (this is exactly the kind
            // of silent catch that caused confusion before) — so we log loudly.
            android.util.Log.e("SmsReceiver", "Failed to process incoming SMS", e)
        }

        // 2. Nudge the foreground service to (re)start, in case it got killed.
        //    This keeps a persistent notification + keeps the process warmer
        //    so future broadcasts are delivered faster/more reliably.
        try {
            val serviceIntent = Intent(context, SmsForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } catch (e: Exception) {
            android.util.Log.e("SmsReceiver", "Failed to start foreground service", e)
        }
    }

    private fun getMessagesFromIntent(intent: Intent): Array<SmsMessage> {
        // Modern, non-deprecated way to extract SMS from the intent
        val pdus = intent.extras?.get("pdus") as? Array<*> ?: return emptyArray()
        val format = intent.extras?.getString("format")
        return pdus.mapNotNull { pdu ->
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    SmsMessage.createFromPdu(pdu as ByteArray, format)
                } else {
                    @Suppress("DEPRECATION")
                    SmsMessage.createFromPdu(pdu as ByteArray)
                }
            } catch (e: Exception) {
                null
            }
        }.toTypedArray()
    }
}
