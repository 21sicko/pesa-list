package com.pesalist.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsForegroundService : Service() {
    private val CHANNEL_ID = "SmsListenerChannel"
    private val NOTIFICATION_ID = 101

    companion object {
        private var isRunning = false
        fun isServiceRunning() = isRunning

        fun processIncomingSms(context: Context, body: String, sender: String) {
            val intent = Intent("com.pesalist.app.SMS_RECEIVED")
            intent.putExtra("body", body)
            intent.putExtra("sender", sender)
            context.sendBroadcast(intent)

            // Also store in SharedPreferences for "Missed Messages"
            val prefs = context.getSharedPreferences("pesa_list_missed", Context.MODE_PRIVATE)
            val current = prefs.getString("messages", "") ?: ""
            val entry = "${System.currentTimeMillis()}|$sender|$body"
            val updated = if (current.isEmpty()) entry else "$current||$entry"
            prefs.edit().putString("messages", updated).apply()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Pesa List Active")
            .setContentText("Listening for M-Pesa payments in background")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()

        startForeground(NOTIFICATION_ID, notification)
        isRunning = true
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "SMS Listener Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        isRunning = false
        super.onDestroy()
    }
}
