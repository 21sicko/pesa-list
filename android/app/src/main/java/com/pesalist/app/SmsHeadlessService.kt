package com.pesalist.app

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class SmsHeadlessService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig? {
        val extras = intent.extras
        return if (extras != null) {
            val data = Arguments.createMap()
            data.putString("body", extras.getString("body"))
            data.putString("sender", extras.getString("sender"))
            HeadlessJsTaskConfig(
                "SmsBackgroundEvent",
                data,
                5000, // Timeout
                true  // Allowed in foreground
            )
        } else {
            null
        }
    }
}
