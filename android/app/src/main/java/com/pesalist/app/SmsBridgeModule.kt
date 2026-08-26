package com.pesalist.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SmsBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SmsBridge"

    /**
     * Returns all queued messages captured while the app was backgrounded/killed,
     * AND clears the queue (so each message is only ever delivered to JS once).
     * Call this on app mount and whenever AppState becomes "active".
     */
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
     * Same as drainStoredMessages but does NOT clear the queue.
     * Useful for debugging / the debug dashboard without consuming messages.
     */
    @ReactMethod
    fun peekStoredMessages(promise: Promise) {
        try {
            val json = SmsCapture.peekAll(reactApplicationContext)
            promise.resolve(json)
        } catch (e: Exception) {
            promise.reject("PEEK_FAILED", e)
        }
    }

    /**
     * Opens the OS dialog asking the user to exempt this app from battery
     * optimization. Should be called once, e.g. during onboarding, with an
     * explanation shown to the user first (Android requires user consent —
     * this cannot be silently auto-granted).
     */
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
