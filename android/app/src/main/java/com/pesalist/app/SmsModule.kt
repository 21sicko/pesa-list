package com.pesalist.app

import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "SmsForegroundModule"

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

        // Clear after reading
        prefs.edit().remove("messages").apply()
        promise.resolve(result)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }
}
