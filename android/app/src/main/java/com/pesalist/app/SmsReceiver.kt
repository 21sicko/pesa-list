package com.pesalist.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            for (msg in messages) {
                val body = msg.displayMessageBody
                val sender = msg.displayOriginatingAddress ?: "UNKNOWN"
                
                // Pass to Foreground Service logic
                SmsForegroundService.processIncomingSms(context, body, sender)
            }
        }
    }
}
