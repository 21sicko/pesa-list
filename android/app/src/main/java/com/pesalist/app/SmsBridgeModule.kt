package com.pesalist.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject

class SmsBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SmsBridge"

    @ReactMethod
    fun drainStoredMessages(promise: Promise) {
        try {
            val json = SmsCapture.drainAll(reactApplicationContext)
            promise.resolve(json)
        } catch (e: Exception) {
            promise.reject("DRAIN_FAILED", e)
        }
    }

    /**
     * Reads messages from the actual SMS inbox within a specific time range.
     * Optimized: Filters for "Confirmed" and M-Pesa keywords at the SQL level.
     */
    @ReactMethod
    fun readInboxRange(dateFrom: Double, dateTo: Double, promise: Promise) {
        try {
            val cursor = reactApplicationContext.contentResolver.query(
                Uri.parse("content://sms/inbox"),
                arrayOf("address", "body", "date"),
                "date >= ? AND date <= ? AND (body LIKE '%Confirmed%' OR body LIKE '%received%' OR body LIKE '%sent%')",
                arrayOf(dateFrom.toLong().toString(), dateTo.toLong().toString()),
                "date DESC"
            )

            val arr = JSONArray()
            if (cursor != null && cursor.moveToFirst()) {
                do {
                    val body = cursor.getString(1)
                    val sender = cursor.getString(0)
                    // Final safety filter
                    if (sender.contains("MPESA", ignoreCase = true) || body.contains("M-PESA", ignoreCase = true)) {
                        val entry = JSONObject()
                        entry.put("originatingAddress", sender)
                        entry.put("body", body)
                        entry.put("timestamp", cursor.getLong(2))
                        arr.put(entry)
                    }
                } while (cursor.moveToNext())
                cursor.close()
            }
            promise.resolve(arr.toString())
        } catch (e: Exception) {
            promise.reject("READ_INBOX_FAILED", e)
        }
    }

    @ReactMethod
    fun peekStoredMessages(promise: Promise) {
        try {
            val json = SmsCapture.peekAll(reactApplicationContext)
            promise.resolve(json)
        } catch (e: Exception) {
            promise.reject("PEEK_FAILED", e)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations() {
        val context = reactApplicationContext
        val packageName = context.packageName
        val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            !pm.isIgnoringBatteryOptimizations(packageName)
        ) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            val context = reactApplicationContext
            val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
            val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pm.isIgnoringBatteryOptimizations(context.packageName)
            } else {
                true
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CHECK_FAILED", e)
        }
    }
}
