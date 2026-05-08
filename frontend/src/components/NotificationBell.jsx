import React, { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { api } from "@/api/client";
import { formatDateTime } from "@/utils/helpers";

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const fetchNotifs = async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data.data.items || []);
      setUnread(data.data.unread_count || 0);
    } catch (e) {}
  };

  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, 60000);
    return () => clearInterval(t);
  }, []);

  const markAllRead = async () => {
    await api.patch("/notifications/read-all");
    fetchNotifs();
  };

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    fetchNotifs();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-testid="notification-bell"
          className="relative p-2 rounded-lg hover:bg-[#f5e8d3]/60 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-stone-700" />
          {unread > 0 && (
            <span
              data-testid="notification-badge"
              className="absolute -top-0.5 -right-0.5 bg-[#14532d] text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 border-[#e5e3db]"
        align="end"
        data-testid="notification-popover"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e3db]">
          <span className="font-display font-semibold text-sm">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              data-testid="mark-all-read-btn"
              className="text-xs h-7"
            >
              <Check className="w-3 h-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-stone-500">No notifications</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                data-testid={`notif-${n.id}`}
                className={`w-full text-left px-4 py-3 border-b border-[#e5e3db]/60 hover:bg-[#fef8f0] transition-colors ${
                  !n.is_read ? "bg-[#fef8f0]/80" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-[#14532d] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-800 leading-snug">{n.message}</p>
                    <p className="text-[11px] text-stone-500 mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
