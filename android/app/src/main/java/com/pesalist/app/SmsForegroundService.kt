package com.pesalist.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps a low-priority persistent notification visible so Android's process
 * killer is much less aggressive with this app. Does NOT do the actual SMS
 * parsing — SmsReceiver + SmsCapture handle that independently. This service
 * mainly buys the app more background survival time on aggressive OEM skins
 * (Tecon/Infinix/Xiaomi battery managers).
 */
class SmsForegroundService : Service() {

    companion object {
        private const val CHANNEL_ID = "pesa_list_sms_monitor"
        private const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY: if the OS kills this service anyway, ask it to
        // recreate the service (without redelivering the last intent) as
        // soon as resources free up.
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Called when the user swipes the app away from recent apps.
        // Restart ourselves so monitoring survives a swipe-away, not just backgrounding.
        val restartIntent = Intent(applicationContext, SmsForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            applicationContext.startForegroundService(restartIntent)
        } else {
            applicationContext.startService(restartIntent)
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Payment Monitoring",
                NotificationManager.IMPORTANCE_MIN // as unobtrusive as possible
            ).apply {
                description = "Keeps Pesa List watching for M-Pesa payment messages"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): android.app.Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Pesa List is watching for payments")
            .setContentText("Tap to open")
            .setSmallIcon(applicationInfo.icon)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .build()
    }
}
