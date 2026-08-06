import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getTripTotals } from './tripManager';

export async function exportTripToPdf(trip) {
  const totals = getTripTotals(trip);
  const date = new Date(trip.startedAt).toLocaleDateString('en-KE');
  const time = new Date(trip.startedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  const rows = trip.payments.map((p, i) => `
    <tr style="border-bottom: 1px solid #EAF3DE;">
      <td style="padding: 10px 0; color: #5F5E5A;">${i + 1}</td>
      <td style="padding: 10px 0;">
        <div style="font-weight: 500; color: #2C2C2A;">${p.senderName}</div>
        <div style="font-size: 11px; color: #888780;">${p.senderPhone || ''}</div>
      </td>
      <td style="padding: 10px 0; color: #888780; font-size: 12px;">${new Date(p.receivedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</td>
      <td style="padding: 10px 0; text-align: right; font-weight: 500; color: ${p.checked ? '#3B6D11' : '#2C2C2A'};">
        Ksh ${p.amount?.toLocaleString() || 0}
      </td>
      <td style="padding: 10px 0; text-align: right;">${p.checked ? '✅' : '⏳'}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #2C2C2A; }
          .header { background: #0A6E2E; padding: 20px; border-radius: 0 0 20px 20px; color: white; margin-bottom: 30px; }
          .title { font-size: 18px; margin: 0; }
          .total-label { color: #C0DD97; font-size: 12px; margin: 15px 0 5px; }
          .total-amt { font-size: 32px; font-weight: bold; margin: 0; }
          .stats { display: flex; gap: 20px; margin-top: 10px; font-size: 12px; color: #EAF3DE; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 11px; color: #5F5E5A; border-bottom: 1px solid #D3D1C7; padding-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="title">Pesa List - Trip Record</p>
          <p class="total-label">Total collected on ${date}</p>
          <p class="total-amt">Ksh ${totals.totalCollected.toLocaleString()}</p>
          <div class="stats">
            <span>${totals.totalPayments} passengers</span>
            <span>Started at ${time}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>PASSENGER</th>
              <th>TIME</th>
              <th style="text-align: right;">AMOUNT</th>
              <th style="text-align: right; width: 40px;">STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
}
