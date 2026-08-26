package com.pesalist.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "SmsForegroundModule"

    init {
        val filter = IntentFilter("com.pesalist.app.SMS_RECEIVED")
        reactContext.registerReceiver(object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val body = intent.getStringExtra("body")
                val sender = intent.getStringExtra("sender")
                val params = Arguments.createMap()
                params.putString("body", body)
                params.putString("sender", sender)
                
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("com.pesalist.app.SMS_RECEIVED", params)
            }
        }, filter, Context.RECEIVER_EXPORTED)
    }

    @ReactMethod
    fun startService(promise: Promise) {
        val intent = Intent(reactApplicationContext, SmsForegroundService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            reactApplicationContext.startForegroundService(intent)
        } else {
            reactApplicationContext.startService(intent)
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        val intent = Intent(reactApplicationContext, SmsForegroundService::class.java)
        reactApplicationContext.stopService(intent)
        promise.resolve(true)
    }

    @ReactMethod
    fun getPendingMessages(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences("pesa_list_missed", Context.MODE_PRIVATE)
        val data = prefs.getString("messages", "") ?: ""
        
        if (data.isEmpty()) {
            promise.resolve(Arguments.createArray())
            return
        }

        val result = Arguments.createArray()
        val entries = data.split("||")
        for (entry in entries) {
            val parts = entry.split("|")
            if (parts.size >= 3) {
                val map = Arguments.createMap()
                map.putString("time", parts[0])
                map.putString("sender", parts[1])
                map.putString("body", parts[2])
                result.pushMap(map)
            }
        }
        prefs.edit().remove("messages").apply()
        promise.resolve(result)
    }

    @ReactMethod
    fun readInbox(limit: Int, promise: Promise) {
        try {
            val cursor = reactApplicationContext.contentResolver.query(
                android.net.Uri.parse("content://sms/inbox"),
                arrayOf("address", "body", "date"),
                null, null, "date DESC LIMIT $limit"
            )
            val result = Arguments.createArray()
            if (cursor != null && cursor.moveToFirst()) {
                do {
                    val map = Arguments.createMap()
                    map.putString("sender", cursor.getString(0))
                    map.putString("body", cursor.getString(1))
                    map.putString("time", cursor.getString(2))
                    result.pushMap(map)
                } while (cursor.moveToNext())
                cursor.close()
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERR", e.message)
        }
    }

    @ReactMethod fun addListener(e: String) {}
    @ReactMethod fun removeListeners(c: Int) {}
}
