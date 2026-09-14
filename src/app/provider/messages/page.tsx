"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send, Phone, UserRound } from "lucide-react";

export default function ProviderMessagesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState("");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Customer Messages</h1>
        <p className="mt-1 text-xs text-ink-mute">
          Direct messaging with customers for active rental bookings and pickup instructions.
        </p>
      </div>

      <div className="grid h-[540px] grid-cols-3 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Chat list */}
        <div className="col-span-1 border-r border-slate-200 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Conversations</p>
          <div className="rounded-xl bg-slate-100 p-3 text-xs cursor-pointer">
            <p className="font-bold text-ink">Customer (Order #NW-8491)</p>
            <p className="text-slate-500 truncate mt-0.5">Where is the exact pickup location?</p>
          </div>
        </div>

        {/* Active conversation body */}
        <div className="col-span-2 flex flex-col justify-between p-4 bg-slate-50/50">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-ink text-sm">Order #NW-8491 • Maruti Ertiga</p>
              <p className="text-[11px] text-slate-500">Customer Mobile: +91 98765 43210</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 py-4 overflow-y-auto">
            <div className="max-w-xs rounded-2xl bg-white p-3 text-xs shadow-sm border border-slate-200">
              <p className="font-semibold text-slate-800">Hi, I booked the Ertiga for tomorrow morning 8 AM. Where is the pickup point?</p>
              <span className="mt-1 block text-[10px] text-slate-400">10:14 AM</span>
            </div>

            <div className="ml-auto max-w-xs rounded-2xl bg-brand-600 p-3 text-xs text-white shadow-sm">
              <p className="font-semibold">Hello! Our garage is at Main Road, Near RTC Bus Stand, Nandyal. Vehicle will be washed and ready.</p>
              <span className="mt-1 block text-[10px] text-brand-200">10:16 AM</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
            <input
              className="input h-10 flex-1 text-xs"
              placeholder="Type message to customer…"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
            />
            <button className="btn-primary !p-2.5 shadow-sm">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
